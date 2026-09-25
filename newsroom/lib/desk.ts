import {createClient} from '@sanity/client'
import {ENGINE_API_VERSION, extractDocumentId} from '@sanity/workflow-engine'
import type {PawnInput, RecordInput, StoryInput} from '../../studio/lib/factcheck'

export const PROJECT_ID = 'lcvgtfvq'
export const DATASET = 'production'

if (!process.env.SANITY_TOKEN) throw new Error('SANITY_TOKEN is not set (see newsroom/.env)')

export const client = createClient({
  projectId: PROJECT_ID,
  dataset: DATASET,
  apiVersion: ENGINE_API_VERSION,
  token: process.env.SANITY_TOKEN,
  perspective: 'raw',
  useCdn: false,
})

export type Story = StoryInput & {
  _id: string
  _rev: string
  section?: string
  pitch?: string
  leads?: {_ref: string}[]
  printedAt?: string
  edition?: number
}

export type DeskRecord = RecordInput & {kind: string; hour?: number; who: string[]}
export type DeskPawn = PawnInput & {name: string; shortName?: string; gender?: string; age?: number; relationNote?: string}

export function subjectId(params: Record<string, unknown>): string {
  if (typeof params.subject !== 'string') throw new Error('subject must be a GDR URI')
  return extractDocumentId(params.subject)
}

/** The story as the desk sees it: the draft when there is one, otherwise the published copy. */
export async function loadStory(id: string): Promise<Story> {
  const story = await client.fetch<Story | null>('coalesce(*[_id == $draft][0], *[_id == $id][0])', {
    id,
    draft: `drafts.${id}`,
  })
  if (!story) throw new Error(`no story ${id}`)
  return story
}

export async function loadMorgue(): Promise<{records: DeskRecord[]; pawns: DeskPawn[]}> {
  return client.fetch(`{
    "records": *[_type == "record" && !(_id in path("drafts.**"))] | order(tick asc)
      {_id, kind, colonyDay, hour, label, text, pawns, "who": pawns[]->shortName},
    "pawns": *[_type == "pawn" && !(_id in path("drafts.**"))]{_id, name, shortName, aliases, gender, age, relationNote}
  }`)
}

export function key(): string {
  return Math.random().toString(36).slice(2, 10)
}
