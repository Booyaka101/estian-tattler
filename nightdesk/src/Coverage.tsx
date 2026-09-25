import {useState} from 'react'
import {useCreateDocument, useQuery} from '@sanity/sdk-react'
import {useWorkflowInstances} from '@sanity/workflow-sdk'
import {instanceDocId, type Engine} from '@sanity/workflow-engine'
import {TAG, WORKFLOW, bareId, storyGdr, subjectOf} from './desk'

interface Rec {
  _id: string
  kind: string
  tick: number
}

interface Pawn {
  _id: string
  name: string
  everColonist?: boolean
  records: Rec[]
}

type StoryPitch = {
  headline: string
  pitch: string
  leads: {_key: string; _type: 'reference'; _ref: string}[]
}

interface Morgue {
  pawns: Pawn[]
  total: number
  printed: string[]
  unprinted: {_id: string; leads: string[] | null}[]
  stories: string[]
}

const QUERY = `{
  "pawns": *[_type == "pawn"]{_id, name, everColonist, "records": *[_type == "record" && references(^._id)]{_id, kind, tick}},
  "total": count(*[_type == "record"]),
  "printed": array::unique(*[_type == "story" && defined(printedAt)].body[].markDefs[_type == "claim"].records[]._ref),
  "unprinted": *[_type == "story" && !defined(printedAt)]{_id, "leads": leads[]._ref},
  "stories": *[_type == "story"]._id
}`

// Talks are mostly small talk; tales and letters make better leads.
const leadsFor = (records: Rec[]) =>
  [...records].sort((a, b) => Number(a.kind === 'talk') - Number(b.kind === 'talk') || b.tick - a.tick).slice(0, 5)

/** How much of the colony the paper has printed, per pawn, and a pitch for whoever it's skipped. */
export function Coverage({engine, onPitched}: {engine: Engine; onPitched: (instanceId: string) => void}) {
  const {data} = useQuery<Morgue>({query: QUERY})
  const createStory = useCreateDocument<StoryPitch>({documentType: 'story'})
  const [pitching, setPitching] = useState<string>()
  const [failure, setFailure] = useState<string>()

  const printed = new Set(data.printed)
  // Only stories with a live run count as on the desk; a spiked story shouldn't lock its leads out of a pitch.
  const {instances} = useWorkflowInstances({engine, filter: {definition: WORKFLOW}})
  const live = new Set(instances?.map(subjectOf))
  const onDesk = new Set(data.unprinted.filter((s) => live.has(bareId(s._id))).flatMap((s) => s.leads ?? []))
  const pawns = data.pawns
    .filter((p) => p.records.length >= 3)
    .map((p) => ({...p, cited: p.records.filter((r) => printed.has(r._id)).length, pending: p.records.some((r) => onDesk.has(r._id))}))
    .sort((a, b) => Number(!!b.everColonist) - Number(!!a.everColonist) || b.records.length - a.records.length)

  const pitch = async (pawn: Pawn) => {
    setPitching(pawn._id)
    setFailure(undefined)
    try {
      const leads = leadsFor(pawn.records.filter((r) => !printed.has(r._id)))
      const slug = `story-${pawn.name.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}`
      const taken = new Set(data.stories.map(bareId))
      let storyId = slug
      for (let n = 2; taken.has(storyId); n++) storyId = `${slug}-${n}`
      await createStory(
        {
          headline: pawn.name,
          pitch: `The paper hasn't printed a word about ${pawn.name}. Start from these records and find the story.`,
          leads: leads.map((r) => ({_key: r._id.replace(/\W/g, ''), _type: 'reference', _ref: r._id})),
        },
        {documentId: storyId},
      )
      // The start's promise can settle well after the run is visible, so open the run by its minted id right away.
      const instanceId = instanceDocId(TAG)
      engine
        .startInstance({
          definition: WORKFLOW,
          instanceId,
          initialFields: [{type: 'subject', name: 'subject', value: {id: storyGdr(storyId), type: 'story'}}],
        })
        .catch((e: Error) => setFailure(e.message))
      onPitched(instanceId)
    } catch (e) {
      setFailure((e as Error).message)
    } finally {
      setPitching(undefined)
    }
  }

  return (
    <section className="coverage">
      <h2>Who we haven't covered</h2>
      <p className="kicker">
        Printed stories cite {printed.size} of {data.total} records.
      </p>
      <ul>
        {pawns.map((p) => (
          <li key={p._id} className={p.everColonist ? 'colonist' : undefined}>
            <span className="who">{p.name}</span>
            <span className="meter" title={`${p.cited} of ${p.records.length} records printed`}>
              <span style={{width: `${(100 * p.cited) / p.records.length}%`}} />
            </span>
            <span className="tally">
              {p.cited}/{p.records.length}
            </span>
            {p.cited > 0 ? (
              <span />
            ) : p.pending ? (
              <span className="kicker">on the desk</span>
            ) : (
              <button disabled={!!pitching} onClick={() => pitch(p)}>
                {pitching === p._id ? 'Pitching…' : 'Pitch'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {failure && <p className="failure">{failure}</p>}
    </section>
  )
}
