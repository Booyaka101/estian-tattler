// The Tattler's fact-check desk. Deterministic on purpose: the same story and records always get the same verdict.

export type Span = {_type: string; text?: string; marks?: string[]}
export type MarkDef = {_key: string; _type: string; records?: {_ref: string}[]}
export type Block = {_type: string; children?: Span[]; markDefs?: MarkDef[]}
export type StoryInput = {headline?: string; dek?: string; body?: Block[]}
export type RecordInput = {_id: string; text?: string; label?: string; colonyDay?: number; pawns?: {_ref: string}[]}
export type PawnInput = {_id: string; aliases?: string[]}
export type Problem = {text: string; reason: string}
export type Verdict = {passed: boolean; claims: number; asides: number; problems: Problem[]}

const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const WORD_NUMBER = new RegExp(`\\b(?:(${TENS.slice(2).join('|')})(?:-(${SMALL.slice(1, 10).join('|')}))?|(${SMALL.join('|')}))\\b`, 'gi')

/** Every number a sentence states, whether written as digits or words. */
export function numbersIn(text: string): number[] {
  const found = [...text.matchAll(/\d+(?:,\d{3})*/g)].map((m) => Number(m[0].replace(/,/g, '')))
  for (const m of text.matchAll(WORD_NUMBER)) {
    found.push(m[3] ? SMALL.indexOf(m[3].toLowerCase()) : TENS.indexOf(m[1].toLowerCase()) * 10 + (m[2] ? SMALL.indexOf(m[2].toLowerCase()) : 0))
  }
  return found
}

/** Names the text mentions, each with every pawn who answers to it. Married couples share a surname. */
function namesIn(text: string, pawns: PawnInput[]): Map<string, string[]> {
  const named = new Map<string, string[]>()
  for (const pawn of pawns) {
    for (const alias of pawn.aliases ?? []) {
      if (alias.length < 3) continue
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, 'u').test(text)) named.set(alias, [...(named.get(alias) ?? []), pawn._id])
    }
  }
  return named
}

function checkClaim(text: string, cited: RecordInput[], pawns: PawnInput[], problems: Problem[]) {
  const inReceipts = new Set(cited.flatMap((r) => (r.pawns ?? []).map((p) => p._ref)))
  for (const [alias, pawnIds] of namesIn(text, pawns)) {
    if (!pawnIds.some((id) => inReceipts.has(id))) problems.push({text, reason: `names ${alias}, but no receipt mentions them`})
  }
  const allowed = new Set<number>([cited.length])
  for (const r of cited) {
    if (r.colonyDay !== undefined) allowed.add(r.colonyDay)
    for (const n of numbersIn(`${r.label ?? ''} ${r.text ?? ''}`)) allowed.add(n)
  }
  for (const n of numbersIn(text)) {
    if (!allowed.has(n)) problems.push({text, reason: `says ${n}, which isn't in its receipts`})
  }
}

export function factCheck(story: StoryInput, records: Map<string, RecordInput>, pawns: PawnInput[]): Verdict {
  const problems: Problem[] = []
  let claims = 0
  let asides = 0
  const allCited = new Map<string, RecordInput>()

  for (const block of story.body ?? []) {
    const defs = new Map((block.markDefs ?? []).map((d) => [d._key, d]))
    for (const span of block.children ?? []) {
      const text = (span.text ?? '').trim()
      if (!/[\p{L}\d]/u.test(text)) continue
      const marks = (span.marks ?? []).map((k) => defs.get(k)).filter((d): d is MarkDef => !!d)
      const claim = marks.find((d) => d._type === 'claim')
      if (claim) {
        claims++
        const cited: RecordInput[] = []
        for (const ref of claim.records ?? []) {
          const record = records.get(ref._ref)
          if (record) {
            cited.push(record)
            allCited.set(record._id, record)
          } else problems.push({text, reason: `cites ${ref._ref}, which isn't a record`})
        }
        if (cited.length === 0) problems.push({text, reason: 'is a claim with no receipts'})
        else checkClaim(text, cited, pawns, problems)
      } else if (marks.some((d) => d._type === 'aside')) {
        asides++
        for (const alias of namesIn(text, pawns).keys()) problems.push({text, reason: `is an aside that names ${alias}`})
        if (numbersIn(text).length) problems.push({text, reason: 'is an aside with a number in it'})
      } else {
        problems.push({text, reason: 'has no receipt and isn\'t marked as an aside'})
      }
    }
  }

  // The headline and dek can say anything the body proved, and nothing it didn't.
  for (const line of [story.headline, story.dek]) {
    if (line) checkClaim(line, [...allCited.values()], pawns, problems)
  }
  if (claims === 0) problems.push({text: story.headline ?? '', reason: 'has no claims at all'})
  return {passed: problems.length === 0, claims, asides, problems}
}
