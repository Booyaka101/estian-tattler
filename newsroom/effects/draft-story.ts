import {createSdkMcpServer, query, tool} from '@anthropic-ai/claude-agent-sdk'
import type {EffectHandler} from '@sanity/workflow-engine'
import {z} from 'zod'
import {factCheck, type Block} from '../../studio/lib/factcheck'
import {client, key, loadMorgue, loadStory, subjectId, type DeskRecord} from '../lib/desk'
import {deskNote} from './fact-check'

export const REPORTER_MODEL = process.env.REPORTER_MODEL ?? 'claude-opus-5-5'

type Sentence = {text: string; records?: string[]; aside?: boolean}
type Filed = {headline: string; dek: string; paragraphs: Sentence[][]}

const FILED_SCHEMA = {
  type: 'object',
  required: ['headline', 'dek', 'paragraphs'],
  additionalProperties: false,
  properties: {
    headline: {type: 'string', maxLength: 90},
    dek: {type: 'string'},
    paragraphs: {
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: 'object',
          required: ['text'],
          additionalProperties: false,
          properties: {
            text: {type: 'string'},
            records: {type: 'array', items: {type: 'string'}},
            aside: {type: 'boolean'},
          },
        },
      },
    },
  },
}

const HOUSE_RULES = `You are a reporter for the Estian Tattler, the gossip paper of a RimWorld colony called the Tribe of Estian.
Everything you know comes from the colony's records: tales, letters, messages and overheard conversations pulled from the save file.

The fact-checker is a program, not a person, and it checks every sentence:
- Each sentence is either a claim or an aside.
- A claim cites the ids of the records that prove it. Only say what those records say.
- Every colonist a claim names must appear in one of its cited records.
- Every number in a claim, in digits or words, must appear in a cited record's text, be a cited record's colony day, or be the count of records cited.
- An aside is the paper's own voice: a quip, a question, a raised eyebrow. Asides may not name anyone and may not contain numbers.
- The headline and dek follow the claim rules, checked against every record the body cites.

Write like a small-town tabloid that loves these people: sharp, warm, a little nosy. Dates are colony days ("on Day 142"). Short paragraphs, 150 to 350 words in all.
Don't invent motives, feelings or events. If the records don't say why something happened, wonder about it in an aside.
Use check_draft before you file, and fix everything it reports.`

function renderRecord(r: DeskRecord): string {
  const head = `${r._id} | Day ${r.colonyDay}, ${r.hour}h | ${r.kind}`
  const body = [r.label, r.text].filter(Boolean).join(': ').replace(/\s+/g, ' ')
  return `${head} | ${body.length > 600 ? body.slice(0, 600) + '...' : body}`
}

export function toPortableText(paragraphs: Sentence[][]): Block[] {
  return paragraphs.map((sentences) => {
    const markDefs: {_key: string; _type: string; records?: {_key: string; _type: string; _ref: string}[]}[] = []
    const children = sentences.map((s, i) => {
      const mark = {_key: key(), _type: s.aside || !s.records?.length ? 'aside' : 'claim'} as (typeof markDefs)[number]
      if (mark._type === 'claim') mark.records = s.records!.map((id) => ({_key: key(), _type: 'reference', _ref: id}))
      markDefs.push(mark)
      const text = i < sentences.length - 1 ? `${s.text.trim()} ` : s.text.trim()
      return {_key: key(), _type: 'span', text, marks: [mark._key]}
    })
    return {_key: key(), _type: 'block', style: 'normal', markDefs, children}
  })
}

/** Sends a Claude reporter into the records with the pitch, and files what comes back as the story's draft. */
export const draftStory: EffectHandler = async (params, ctx) => {
  const id = subjectId(params)
  const [story, morgue] = await Promise.all([loadStory(id), loadMorgue()])
  const byId = new Map(morgue.records.map((r) => [r._id, r]))
  const text = (t: string) => ({content: [{type: 'text' as const, text: t}]})

  const morgueServer = createSdkMcpServer({
    name: 'morgue',
    tools: [
      tool(
        'search_records',
        'Search the colony records. Every filter is optional and they combine. Returns at most 60 records, oldest first.',
        {
          words: z.string().optional().describe('words that must all appear in the record text or label'),
          colonist: z.string().optional().describe('a colonist name or nickname'),
          fromDay: z.number().optional(),
          toDay: z.number().optional(),
          kind: z.enum(['tale', 'letter', 'message', 'talk']).optional(),
        },
        async ({words, colonist, fromDay, toDay, kind}) => {
          const needles = (words ?? '').toLowerCase().split(/\s+/).filter(Boolean)
          const who = colonist ? morgue.pawns.filter((p) => p.aliases?.some((a) => a.toLowerCase() === colonist.toLowerCase())) : []
          const hits = morgue.records.filter((r) => {
            const hay = `${r.label ?? ''} ${r.text ?? ''}`.toLowerCase()
            return (
              needles.every((n) => hay.includes(n)) &&
              (!colonist || r.pawns?.some((p) => who.some((w) => w._id === p._ref))) &&
              (fromDay === undefined || (r.colonyDay ?? 0) >= fromDay) &&
              (toDay === undefined || (r.colonyDay ?? 0) <= toDay) &&
              (!kind || r.kind === kind)
            )
          })
          const shown = hits.slice(0, 60).map(renderRecord).join('\n')
          return text(hits.length > 60 ? `${hits.length} matches, first 60:\n${shown}` : shown || 'No records match.')
        },
      ),
      tool('who_is', 'Look up a colonist or visitor by any of their names.', {name: z.string()}, async ({name}) => {
        const found = morgue.pawns.filter((p) => p.aliases?.some((a) => a.toLowerCase().includes(name.toLowerCase())))
        if (!found.length) return text(`Nobody called ${name} in the records.`)
        return text(
          found
            .map((p) => {
              const theirs = morgue.records.filter((r) => r.pawns?.some((ref) => ref._ref === p._id))
              const days = theirs.map((r) => r.colonyDay ?? 0)
              return `${p.name} (${[p.gender, p.age && `age ${p.age}`, p.relationNote].filter(Boolean).join(', ')}). ` +
                `Also known as ${p.aliases?.join(', ')}. In ${theirs.length} records, Day ${Math.min(...days)} to Day ${Math.max(...days)}.`
            })
            .join('\n'),
        )
      }),
      tool(
        'check_draft',
        'Run the fact-checker on a draft before you file it. Same input shape as the final answer.',
        {
          headline: z.string(),
          dek: z.string(),
          paragraphs: z.array(z.array(z.object({text: z.string(), records: z.array(z.string()).optional(), aside: z.boolean().optional()}))),
        },
        async (draft) => {
          const verdict = factCheck({...draft, body: toPortableText(draft.paragraphs)}, byId, morgue.pawns)
          return text(verdict.passed ? `Clean: ${verdict.claims} claims, ${verdict.asides} asides.` : deskNote(verdict))
        },
      ),
    ],
  })

  const leads = (story.leads ?? []).map((l) => byId.get(l._ref)).filter((r): r is DeskRecord => !!r)
  const note = typeof params.note === 'string' && params.note ? params.note : ''
  const prompt = [
    `Section: ${story.section ?? 'Front page'}`,
    `Working headline: ${story.headline ?? '(none)'}`,
    `Pitch: ${story.pitch ?? '(none)'}`,
    leads.length ? `Leads from the pitch:\n${leads.map(renderRecord).join('\n')}` : '',
    note ? `This is a rewrite. The desk sent it back with this note:\n${note}` : '',
    'The records run from Day 117 to Day 306, today. Report the story, check it, then file it.',
  ].filter(Boolean).join('\n\n')

  await ctx.setProgress('reporting', 5)
  let filed: Filed | undefined
  let calls = 0
  for await (const msg of query({
    prompt,
    options: {
      model: REPORTER_MODEL,
      systemPrompt: HOUSE_RULES,
      tools: [],
      mcpServers: {morgue: morgueServer},
      allowedTools: ['mcp__morgue__search_records', 'mcp__morgue__who_is', 'mcp__morgue__check_draft'],
      permissionMode: 'dontAsk',
      settingSources: [],
      persistSession: false,
      maxTurns: 40,
      outputFormat: {type: 'json_schema', schema: FILED_SCHEMA},
    },
  })) {
    if (msg.type === 'assistant') {
      calls += msg.message.content.filter((c: {type: string}) => c.type === 'tool_use').length
      await ctx.setProgress('reporting', Math.min(90, 5 + calls * 6))
    }
    if (msg.type === 'result') {
      if (msg.subtype !== 'success') throw new Error(`reporter came back empty: ${msg.subtype}`)
      filed = msg.structured_output as Filed
    }
  }
  if (!filed) throw new Error('reporter never filed')

  const {_rev, factCheck: _stale, ...rest} = story as typeof story & {factCheck?: unknown}
  await client.createOrReplace({
    ...rest,
    _id: `drafts.${id}`,
    _type: 'story',
    headline: filed.headline,
    dek: filed.dek,
    body: toPortableText(filed.paragraphs),
    byline: `${REPORTER_MODEL}, Claude Agent SDK`,
  })
  await ctx.setProgress('reporting', 100)
  ctx.log(`filed "${filed.headline}" after ${calls} tool calls`)
}
