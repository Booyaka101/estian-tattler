import type {EffectHandler} from '@sanity/workflow-engine'
import {factCheck, type Verdict} from '../../studio/lib/factcheck'
import {client, key, loadMorgue, loadStory, subjectId} from '../lib/desk'

export function deskNote(verdict: Verdict): string {
  return verdict.problems.map((p) => `"${p.text}" ${p.reason}.`).join('\n')
}

/** Checks the filed story against the records and stamps the verdict on it. */
export const factCheckStory: EffectHandler = async (params, ctx) => {
  const [story, morgue] = await Promise.all([loadStory(subjectId(params)), loadMorgue()])
  const verdict = factCheck(story, new Map(morgue.records.map((r) => [r._id, r])), morgue.pawns)
  await client
    .patch(story._id)
    .set({
      factCheck: {
        ...verdict,
        checkedAt: new Date().toISOString(),
        problems: verdict.problems.map((p) => ({_key: key(), ...p})),
      },
    })
    .commit()
  ctx.log(`${verdict.passed ? 'passed' : 'failed'}: ${verdict.claims} claims, ${verdict.problems.length} problems`)
  const note = {field: 'deskNote', scope: 'workflow'} as const
  return {
    outputs: {passed: verdict.passed},
    ops: verdict.passed
      ? [{type: 'field.unset', target: note}]
      : [{type: 'field.set', target: note, value: {type: 'literal', value: deskNote(verdict)}}],
  }
}
