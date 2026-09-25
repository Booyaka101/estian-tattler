import {createClient} from '@sanity/client'
import type {PortableTextBlock} from '@portabletext/react'

const client = createClient({
  projectId: 'lcvgtfvq',
  dataset: 'production',
  apiVersion: '2025-02-19',
  perspective: 'published',
  useCdn: false,
})

export type Receipt = {_id: string; kind: string; colonyDay: number; hour: number; label?: string; text: string}

export type Story = {
  _id: string
  headline: string
  dek?: string
  section?: string
  byline?: string
  edition: number
  printedAt: string
  claims: number
  body: PortableTextBlock[]
}

export type Colony = {name: string; currentDay: number; firstRecordDay: number; recordCount: number; modCount: number; gameVersion: string}

const STORY = `{
  _id, headline, dek, section, byline, edition, printedAt,
  "claims": factCheck.claims,
  body[]{..., markDefs[]{..., _type == "claim" => {"receipts": records[]->{_id, kind, colonyDay, hour, label, text}}}}
}`

export async function getPaper(): Promise<{colony: Colony; stories: Story[]}> {
  return client.fetch(`{
    "colony": *[_id == "colony"][0],
    "stories": *[_type == "story" && defined(printedAt)] | order(edition desc) ${STORY}
  }`)
}

export async function getStory(id: string): Promise<Story | null> {
  return client.fetch(`*[_type == "story" && _id == $id && defined(printedAt)][0] ${STORY}`, {id})
}

export function slug(story: Pick<Story, '_id'>): string {
  return story._id.replace(/^story-/, '')
}

/** Every record a story cites, oldest first, once each. */
export function receiptsOf(story: Story): Receipt[] {
  const all = new Map<string, Receipt>()
  for (const block of story.body ?? []) {
    for (const def of (block.markDefs ?? []) as {receipts?: Receipt[]}[]) {
      for (const r of def.receipts ?? []) all.set(r._id, r)
    }
  }
  return [...all.values()].sort((a, b) => a.colonyDay - b.colonyDay || a.hour - b.hour)
}
