import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {workflowStudioPlugin} from '@sanity/workflow-studio-plugin'
import {schemaTypes} from './schemaTypes'
import {defaultDocumentNode, structure} from './structure'
import {PitchAction} from './components/PitchAction'

export default defineConfig({
  name: 'default',
  title: 'Estian Tattler',

  projectId: 'lcvgtfvq',
  dataset: 'production',

  plugins: [
    structureTool({structure, defaultDocumentNode}),
    workflowStudioPlugin({
      tag: 'production',
      mappings: [{docType: 'story', definition: 'story-desk', label: 'Story desk'}],
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },

  document: {
    actions: (prev, {schemaType}) => (schemaType === 'record' ? [PitchAction, ...prev] : prev),
  },
})
