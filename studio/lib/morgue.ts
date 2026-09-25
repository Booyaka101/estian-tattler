import type {SanityClient} from 'sanity'
import {factCheck, type Block, type PawnInput, type RecordInput, type StoryInput, type Verdict} from './factcheck'

export type Receipt = RecordInput & {kind?: string; hour?: number}

export function citedIds(body: Block[] = []): string[] {
  const ids = body.flatMap((b) => (b.markDefs ?? []).flatMap((d) => (d.records ?? []).map((r) => r._ref)))
  return [...new Set(ids)]
}

/** Fetches what a story cites plus every pawn, and runs the same check the newsroom runs. */
export async function checkWithMorgue(
  client: SanityClient,
  story: StoryInput,
): Promise<{verdict: Verdict; receipts: Map<string, Receipt>}> {
  const {records, pawns} = await client.fetch<{records: Receipt[]; pawns: PawnInput[]}>(
    `{
      "records": *[_type == "record" && _id in $ids]{_id, kind, colonyDay, hour, label, text, pawns},
      "pawns": *[_type == "pawn" && !(_id in path("drafts.**"))]{_id, aliases}
    }`,
    {ids: citedIds(story.body)},
  )
  const receipts = new Map(records.map((r) => [r._id, r]))
  return {verdict: factCheck(story, receipts, pawns), receipts}
}
