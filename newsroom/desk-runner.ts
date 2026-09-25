// The newsroom: drains the story desk's queued effects. Run with `npm run desk` (or `npm run desk -- --once`).
import {createEngine, instancesQuery, type EffectHandler} from '@sanity/workflow-engine'
import {draftStory} from './effects/draft-story'
import {factCheckStory} from './effects/fact-check'
import {printStory} from './effects/print'
import {client, DATASET, PROJECT_ID} from './lib/desk'

const TAG = 'production'
const POLL_MS = 5000

export const handlers: Record<string, EffectHandler> = {
  'draft-story': draftStory,
  'fact-check': factCheckStory,
  print: printStory,
}

const engine = createEngine({
  client,
  workflowResource: {type: 'dataset', id: `${PROJECT_ID}.${DATASET}`},
  tag: TAG,
  executionContext: {kind: 'server', id: 'estian-newsroom'},
  effects: {handlers, leaseMs: 20 * 60 * 1000},
})

async function queued(): Promise<string[]> {
  const {query, params} = instancesQuery({tag: TAG, filter: {includeCompleted: true}})
  return client.fetch(`${query}[count(pendingEffects[!defined(claim)]) > 0]._id`, params)
}

async function round() {
  for (const instanceId of await queued()) {
    const started = Date.now()
    try {
      const {drained, failed} = await engine.drainEffects({instanceId})
      for (const e of drained) console.log(`${instanceId} ${e.name} done (${Math.round((Date.now() - started) / 1000)}s)`)
      for (const e of failed) console.error(`${instanceId} ${e.name} failed`)
    } catch (error) {
      console.error(`${instanceId}: ${error instanceof Error ? error.message : error}`)
    }
  }
}

await engine.verifyDeployedDefinitions()
if (process.argv.includes('--once')) {
  await round()
} else {
  console.log(`newsroom open, watching ${PROJECT_ID}.${DATASET}`)
  for (;;) {
    await round()
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}
