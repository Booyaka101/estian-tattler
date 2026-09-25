import type {WorkflowInstance} from '@sanity/workflow-engine'

export const PROJECT_ID = 'lcvgtfvq'
export const DATASET = 'production'
export const WORKFLOW = 'story-desk'
export const TAG = 'production'
export const STUDIO = 'https://estian-tattler.sanity.studio'

export const workflowResource = {type: 'dataset', id: `${PROJECT_ID}.${DATASET}`} as const

export const storyGdr = (id: string) => `dataset:${PROJECT_ID}:${DATASET}:${id}` as const

export interface StageInfo {
  name: string
  title: string
}

/** Stage order and titles as the instance was started with them, so the board follows the deployed definition. */
export function stagesOf(instance: WorkflowInstance): StageInfo[] {
  const def = JSON.parse(instance.definitionSnapshot) as {stages: {name: string; title?: string}[]}
  return def.stages.map((s) => ({name: s.name, title: s.title ?? s.name}))
}

export function fieldOf<T>(instance: WorkflowInstance, name: string): T | undefined {
  return instance.fields.find((f) => f.name === name)?.value as T | undefined
}

/** The story document id a run is about, without the resource prefix. */
export function subjectOf(instance: WorkflowInstance): string | undefined {
  return fieldOf<{id: string}>(instance, 'subject')?.id.split(':').pop()
}

export const bareId = (id: string) => id.replace(/^drafts\./, '')

export function ago(iso: string) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}
