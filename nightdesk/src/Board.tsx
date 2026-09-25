import {useQuery} from '@sanity/sdk-react'
import {useWorkflowInstances} from '@sanity/workflow-sdk'
import type {Engine} from '@sanity/workflow-engine'
import {WORKFLOW, ago, bareId, fieldOf, stagesOf, subjectOf} from './desk'

interface StoryRow {
  _id: string
  headline?: string
  section?: string
  edition?: number
}

/** Every story-desk run, one column per stage, live. */
export function Board({engine, open, onOpen}: {engine: Engine; open?: string; onOpen: (id: string) => void}) {
  const {instances, loading, error} = useWorkflowInstances({engine, filter: {definition: WORKFLOW, includeCompleted: true}})
  const {data: stories} = useQuery<StoryRow[]>({query: '*[_type == "story"]{_id, headline, section, edition}'})
  const headlines = new Map(stories.map((s) => [bareId(s._id), s]))

  if (error) return <p className="quiet">The run list failed to load: {String(error)}</p>
  if (loading || !instances) return <p className="quiet">Pulling the runs…</p>
  if (!instances.length) return <p className="quiet">Nothing on the desk. Pitch a colonist below.</p>

  const stages = stagesOf(instances[0])
  const runs = instances.filter((r) => !r.abortedAt).sort((a, b) => b.lastChangedAt.localeCompare(a.lastChangedAt))

  return (
    <div className="board">
      {stages.map((stage) => {
        const here = runs.filter((r) => r.currentStage === stage.name)
        return (
          <section key={stage.name} className={`column stage-${stage.name}`}>
            <h2>
              {stage.title} <span className="count">{here.length}</span>
            </h2>
            {here.map((run) => {
              const story = headlines.get(subjectOf(run) ?? '')
              const note = fieldOf<string>(run, 'deskNote')
              return (
                <button key={run._id} className={`card${run._id === open ? ' open' : ''}`} onClick={() => onOpen(run._id)}>
                  <span className="kicker">
                    {[story?.edition && `Edition ${story.edition}`, story?.section, ago(run.lastChangedAt)].filter(Boolean).join(' · ')}
                  </span>
                  <strong>{story?.headline || subjectOf(run)}</strong>
                  {note && stage.name === 'reporting' && <span className="note">Desk note: {note}</span>}
                </button>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
