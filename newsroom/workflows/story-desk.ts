import {
  defineAction,
  defineActivity,
  defineField,
  defineStage,
  defineTransition,
  defineWorkflow,
} from '@sanity/workflow-engine/define'

export const MAX_DRAFTS = 3

const drafted = "$effectStatus['draft-story'] == 'done'"
const checked = "$allActivitiesDone && $effectStatus['fact-check'] == 'done'"

/** A story's trip through the Tattler: reported by the model, checked by code, printed by a person. */
export const storyDesk = defineWorkflow({
  name: 'story-desk',
  title: 'Story desk',
  description: 'Reporting, fact-check against the save, the editor, then the press.',
  initialStage: 'reporting',
  fields: [
    defineField({type: 'subject', name: 'subject', title: 'Story', initialValue: {type: 'input'}, required: true}),
    defineField({type: 'number', name: 'drafts', title: 'Drafts filed', initialValue: {type: 'literal', value: 0}}),
    defineField({type: 'text', name: 'deskNote', title: 'Note for the reporter'}),
    defineField({type: 'progress', name: 'reporting', title: 'Reporting'}),
  ],
  stages: [
    defineStage({
      name: 'reporting',
      title: 'Reporting',
      activities: [
        defineActivity({
          name: 'report',
          title: 'Write it from the records',
          actions: [
            defineAction({
              name: 'assign',
              title: 'Send a reporter',
              when: 'true',
              ops: [{type: 'field.inc', target: {field: 'drafts', scope: 'workflow'}}],
              effects: [
                {name: 'draft-story', bindings: {subject: '$fields.subject._id', note: '$fields.deskNote'}},
              ],
            }),
            defineAction({name: 'filed', title: 'Draft filed', when: drafted, status: 'done'}),
            defineAction({
              name: 'lost',
              title: 'Reporter never filed',
              when: "$effectStatus['draft-story'] == 'failed'",
              status: 'failed',
            }),
          ],
        }),
      ],
      transitions: [defineTransition({name: 'to-fact-check', to: 'fact-check'})],
    }),
    defineStage({
      name: 'fact-check',
      title: 'Fact-check',
      activities: [
        defineActivity({
          name: 'check',
          title: 'Check every sentence against its receipts',
          actions: [
            defineAction({
              name: 'run',
              title: 'Run the fact-check',
              when: 'true',
              effects: [
                {
                  name: 'fact-check',
                  bindings: {subject: '$fields.subject._id'},
                  outputs: [{type: 'boolean', name: 'passed'}],
                },
              ],
            }),
            defineAction({name: 'checked', title: 'Checked', when: "$effectStatus['fact-check'] == 'done'", status: 'done'}),
            defineAction({
              name: 'broken',
              title: 'Fact-check crashed',
              when: "$effectStatus['fact-check'] == 'failed'",
              status: 'failed',
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'clean', to: 'editor', when: `${checked} && $effects['fact-check'].passed`}),
        defineTransition({
          name: 'rewrite',
          title: 'Back to the reporter',
          to: 'reporting',
          when: `${checked} && !$effects['fact-check'].passed && $fields.drafts < ${MAX_DRAFTS}`,
        }),
        defineTransition({
          name: 'kill',
          title: 'Spiked by the fact-checker',
          to: 'spiked',
          when: `${checked} && !$effects['fact-check'].passed && $fields.drafts >= ${MAX_DRAFTS}`,
        }),
      ],
    }),
    defineStage({
      name: 'editor',
      title: "Editor's desk",
      fields: [defineField({type: 'string', name: 'decision', title: 'Decision'})],
      activities: [
        defineActivity({
          name: 'review',
          title: 'Read it and decide',
          actions: [
            defineAction({
              name: 'approve',
              title: 'Send to press',
              status: 'done',
              ops: [{type: 'field.set', target: {field: 'decision'}, value: {type: 'literal', value: 'print'}}],
            }),
            defineAction({
              name: 'send-back',
              title: 'Send back',
              status: 'done',
              params: [{type: 'string', name: 'note', title: 'What to fix', required: true}],
              ops: [
                {type: 'field.set', target: {field: 'decision'}, value: {type: 'literal', value: 'rewrite'}},
                {type: 'field.set', target: {field: 'deskNote', scope: 'workflow'}, value: {type: 'param', param: 'note'}},
                {type: 'field.set', target: {field: 'drafts', scope: 'workflow'}, value: {type: 'literal', value: 0}},
              ],
            }),
            defineAction({
              name: 'spike',
              title: 'Spike it',
              status: 'done',
              ops: [{type: 'field.set', target: {field: 'decision'}, value: {type: 'literal', value: 'spike'}}],
            }),
          ],
        }),
      ],
      transitions: [
        defineTransition({name: 'to-press', to: 'printing', when: "$allActivitiesDone && $fields.decision == 'print'"}),
        defineTransition({name: 'rewrite', to: 'reporting', when: "$allActivitiesDone && $fields.decision == 'rewrite'"}),
        defineTransition({name: 'spike', to: 'spiked', when: "$allActivitiesDone && $fields.decision == 'spike'"}),
      ],
    }),
    defineStage({
      name: 'printing',
      title: 'On the press',
      activities: [
        defineActivity({
          name: 'press',
          title: 'Print and rebuild the front page',
          actions: [
            defineAction({
              name: 'run',
              title: 'Start the press',
              when: 'true',
              effects: [{name: 'print', bindings: {subject: '$fields.subject._id'}}],
            }),
            defineAction({name: 'printed', title: 'Printed', when: "$effectStatus['print'] == 'done'", status: 'done'}),
            defineAction({
              name: 'jammed',
              title: 'Press jammed',
              when: "$effectStatus['print'] == 'failed'",
              status: 'failed',
            }),
          ],
        }),
      ],
      transitions: [defineTransition({name: 'to-printed', to: 'printed'})],
    }),
    defineStage({name: 'printed', title: 'Printed'}),
    defineStage({name: 'spiked', title: 'Spiked'}),
  ],
})
