import {defineWorkflowConfig} from '@sanity/workflow-engine/define'
import {storyDesk} from './workflows/story-desk'

export default defineWorkflowConfig({
  deployments: [
    {
      name: 'production',
      tag: 'production',
      expectedMinReaderModel: 10,
      workflowResource: {type: 'dataset', id: 'lcvgtfvq.production'},
      definitions: [storyDesk],
    },
  ],
})
