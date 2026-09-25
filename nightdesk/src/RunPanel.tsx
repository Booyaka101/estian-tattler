import {Suspense, useState} from 'react'
import {useQuery} from '@sanity/sdk-react'
import {useWorkflowSession} from '@sanity/workflow-sdk'
import type {ActionEvaluation, ActivityEvaluation, Engine} from '@sanity/workflow-engine'
import {STUDIO, ago, fieldOf, stagesOf, subjectOf} from './desk'

interface Proof {
  headline?: string
  dek?: string
  byline?: string
  body?: {_key: string; children: {_key: string; text: string; marks?: string[]}[]; markDefs?: {_key: string; _type: string; n?: number}[]}[]
}

/** The story as the editor would read it: claims underlined with how many records back them, asides in grey. */
function StoryProof({id}: {id: string}) {
  const {data: story} = useQuery<Proof | null>({
    query: '*[_id == $id][0]{headline, dek, byline, body[]{_key, children[]{_key, text, marks}, markDefs[]{_key, _type, "n": count(records)}}}',
    params: {id},
  })
  if (!story) return <p className="quiet">No story document yet.</p>
  if (!story.body?.length) return <h3>{story.headline}</h3>

  return (
    <article className="proof">
      <h3>{story.headline}</h3>
      <p className="dek">{story.dek}</p>
      {story.body.map((block) => (
        <p key={block._key}>
          {block.children.map((span) => {
            const mark = block.markDefs?.find((m) => span.marks?.includes(m._key))
            if (mark?._type === 'claim')
              return (
                <span key={span._key} className="claim" title={`${mark.n} record${mark.n === 1 ? '' : 's'}`}>
                  {span.text}
                  <sup>{mark.n}</sup>
                </span>
              )
            return (
              <span key={span._key} className={mark?._type === 'aside' ? 'aside' : undefined}>
                {span.text}
              </span>
            )
          })}
        </p>
      ))}
      {story.byline && <p className="kicker">{story.byline}</p>}
    </article>
  )
}

function ActionButton({activity, evaluation, fire}: {
  activity: ActivityEvaluation
  evaluation: ActionEvaluation
  fire: (activity: string, action: string, params?: Record<string, unknown>) => Promise<void>
}) {
  const {action, allowed} = evaluation
  const params = action.params ?? []
  const [values, setValues] = useState<Record<string, string>>({})
  const missing = params.some((p) => p.required && !values[p.name]?.trim())

  return (
    <div className={`action action-${action.name}`}>
      {params.map((p) => (
        <textarea
          key={p.name}
          placeholder={p.title ?? p.name}
          value={values[p.name] ?? ''}
          onChange={(e) => setValues({...values, [p.name]: e.target.value})}
        />
      ))}
      <button disabled={!allowed || missing} onClick={() => fire(activity.activity.name, action.name, params.length ? values : undefined)}>
        {action.title ?? action.name}
      </button>
    </div>
  )
}

/** One run, driven through a live workflow session: what stage it's in, the story itself, and the editor's buttons. */
export function RunPanel({engine, instanceId, onClose}: {engine: Engine; instanceId: string; onClose: () => void}) {
  const {evaluation, ready, error, invalid, fireAction} = useWorkflowSession({engine, instanceId})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string>()

  if (invalid) return <aside className="run">This run can't be read by this engine version ({invalid.reason}).</aside>
  if (error) return <aside className="run">Lost the run: {String(error)}</aside>
  if (!evaluation) return <aside className="run quiet">Opening the file…</aside>

  const {instance, currentStage} = evaluation
  const titles = new Map(stagesOf(instance).map((s) => [s.name, s.title]))
  const storyId = subjectOf(instance)
  const buttons = currentStage.activities.flatMap((a) => a.actions.filter((x) => !x.triggered).map((x) => ({a, x})))
  const moves = instance.history.filter((h) => h._type === 'stageEntered') as {_key: string; stage: string; at: string; actor?: {kind: string}}[]

  const fire = async (activity: string, action: string, params?: Record<string, unknown>) => {
    setBusy(true)
    setFailure(undefined)
    try {
      await fireAction({activity, action, params})
    } catch (e) {
      setFailure((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="run">
      <div className="run-head">
        <span className="section">{titles.get(instance.currentStage)}</span>
        <span className="kicker">
          Drafts filed: {fieldOf<number>(instance, 'drafts') ?? 0}
          {storyId && (
            <>
              {' · '}
              <a href={`${STUDIO}/structure/story;${storyId}`} target="_blank" rel="noreferrer">
                Open in Studio
              </a>
            </>
          )}
        </span>
        <button className="close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {storyId && (
        <Suspense fallback={<p className="quiet">Fetching the copy…</p>}>
          <StoryProof id={storyId} />
        </Suspense>
      )}

      {buttons.length > 0 ? (
        <div className={`actions${busy || !ready ? ' busy' : ''}`}>
          {buttons.map(({a, x}) => (
            <ActionButton key={`${a.activity.name}/${x.action.name}`} activity={a} evaluation={x} fire={fire} />
          ))}
        </div>
      ) : (
        currentStage.activities.map((a) => (
          <p key={a.activity.name} className="quiet">
            {a.activity.title}: {a.status}
          </p>
        ))
      )}
      {failure && <p className="failure">{failure}</p>}

      <ol className="moves">
        {moves.map((m) => (
          <li key={m._key}>
            {titles.get(m.stage) ?? m.stage} <span className="kicker">{ago(m.at)}</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}
