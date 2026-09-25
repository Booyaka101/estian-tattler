import type {EffectHandler} from '@sanity/workflow-engine'
import {client, loadStory, subjectId} from '../lib/desk'

const REPO = process.env.GITHUB_REPO ?? 'Booyaka101/estian-tattler'

/** Stamps the edition, publishes the story, and asks GitHub to rebuild the front page. */
export const printStory: EffectHandler = async (params, ctx) => {
  const id = subjectId(params)
  const story = await loadStory(id)
  if (!story.printedAt || story._id.startsWith('drafts.')) {
    const edition =
      story.edition ?? (await client.fetch<number>('count(*[_type == "story" && defined(printedAt) && !(_id in path("drafts.**"))])')) + 1
    await client
      .patch(story._id)
      .set({printedAt: story.printedAt ?? new Date().toISOString(), edition})
      .commit()
    if (story._id.startsWith('drafts.')) {
      await client.action({actionType: 'sanity.action.document.publish', publishedId: id, draftId: story._id})
    }
    ctx.log(`printed ${id} in edition ${edition}`)
  }

  const token = process.env.GITHUB_TOKEN
  if (!token) return ctx.log('GITHUB_TOKEN not set, front page not rebuilt')
  const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`, accept: 'application/vnd.github+json'},
    body: JSON.stringify({event_type: 'print', client_payload: {story: id, effect: ctx.effectKey}}),
  })
  if (!res.ok) throw new Error(`GitHub dispatch failed: ${res.status} ${await res.text()}`)
}
