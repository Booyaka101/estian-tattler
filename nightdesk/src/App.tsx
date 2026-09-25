import {Suspense, useState} from 'react'
import {SanityApp} from '@sanity/sdk-react'
import {WorkflowTelemetryProvider, useWorkflowEngine} from '@sanity/workflow-sdk'
import {Board} from './Board'
import {Coverage} from './Coverage'
import {RunPanel} from './RunPanel'
import {DATASET, PROJECT_ID, TAG, workflowResource} from './desk'
import './App.css'

function NightDesk() {
  const engine = useWorkflowEngine({workflowResource, tag: TAG})
  const [open, setOpen] = useState<string>()

  return (
    <div className="desk">
      <header className="masthead">
        <span className="nameplate">The Night Desk</span>
        <span className="strap">Every story the Estian Tattler has in the works, and every colonist it hasn't got to yet.</span>
      </header>
      <Suspense fallback={<p className="quiet">Pulling the runs…</p>}>
        <Board engine={engine} open={open} onOpen={setOpen} />
      </Suspense>
      <div className="lower">
        {open ? (
          <Suspense key={open} fallback={<p className="quiet">Opening the file…</p>}>
            <RunPanel engine={engine} instanceId={open} onClose={() => setOpen(undefined)} />
          </Suspense>
        ) : (
          <p className="quiet run">Pick a story on the board to read it and decide.</p>
        )}
        <Suspense fallback={<p className="quiet">Counting receipts…</p>}>
          <Coverage engine={engine} onPitched={setOpen} />
        </Suspense>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <SanityApp config={[{projectId: PROJECT_ID, dataset: DATASET}]} fallback={<p className="quiet">Setting type…</p>}>
      <WorkflowTelemetryProvider>
        <NightDesk />
      </WorkflowTelemetryProvider>
    </SanityApp>
  )
}
