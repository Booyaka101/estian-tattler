import {defineArrayMember, defineField, defineType} from 'sanity'
import {ClaimAnnotation, AsideAnnotation} from '../components/annotations'
import {checkWithMorgue} from '../lib/morgue'
import type {StoryInput} from '../lib/factcheck'

export const SECTIONS = ['Front page', 'Hearts', 'Science', 'Brawls', 'Commerce', 'Weather', 'Graves']

export const story = defineType({
  name: 'story',
  title: 'Story',
  type: 'document',
  // The desk won't publish a story the fact-checker would reject, whoever edited it last.
  validation: (rule) =>
    rule.custom(async (doc, context) => {
      if (!doc) return true
      const {verdict} = await checkWithMorgue(context.getClient({apiVersion: '2025-02-19'}), doc as StoryInput)
      if (verdict.passed) return true
      return verdict.problems.slice(0, 3).map((p) => `"${p.text}" ${p.reason}`).join('\n')
    }),
  fields: [
    defineField({name: 'headline', type: 'string', validation: (rule) => rule.required().max(90)}),
    defineField({name: 'dek', type: 'string', description: 'The line under the headline.'}),
    defineField({name: 'section', type: 'string', options: {list: SECTIONS}}),
    defineField({
      name: 'pitch',
      type: 'text',
      rows: 2,
      description: 'What the desk wants from the reporter.',
    }),
    defineField({
      name: 'leads',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'record'}]})],
      description: 'The records the pitch starts from. The reporter can dig up more.',
    }),
    defineField({
      name: 'body',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [{title: 'Normal', value: 'normal'}],
          lists: [],
          marks: {
            decorators: [],
            annotations: [
              {
                name: 'claim',
                type: 'object',
                title: 'Claim',
                components: {annotation: ClaimAnnotation},
                fields: [
                  defineField({
                    name: 'records',
                    type: 'array',
                    of: [defineArrayMember({type: 'reference', to: [{type: 'record'}]})],
                    validation: (rule) => rule.min(1),
                  }),
                ],
              },
              {
                name: 'aside',
                type: 'object',
                title: 'Aside',
                description: "The paper's opinion. Can't name a pawn or carry a number.",
                components: {annotation: AsideAnnotation},
                fields: [defineField({name: 'note', type: 'string'})],
              },
            ],
          },
        }),
      ],
    }),
    defineField({name: 'byline', type: 'string'}),
    defineField({
      name: 'factCheck',
      type: 'object',
      readOnly: true,
      description: 'Written by the fact-check desk. Every sentence needs a receipt or an aside mark.',
      fields: [
        defineField({name: 'passed', type: 'boolean'}),
        defineField({name: 'checkedAt', type: 'datetime'}),
        defineField({name: 'claims', type: 'number'}),
        defineField({name: 'asides', type: 'number'}),
        defineField({
          name: 'problems',
          type: 'array',
          of: [
            defineArrayMember({
              type: 'object',
              name: 'problem',
              fields: [
                defineField({name: 'text', type: 'string'}),
                defineField({name: 'reason', type: 'string'}),
              ],
              preview: {select: {title: 'reason', subtitle: 'text'}},
            }),
          ],
        }),
      ],
    }),
    defineField({name: 'edition', type: 'number', readOnly: true}),
    defineField({name: 'printedAt', type: 'datetime', readOnly: true}),
  ],
  preview: {
    select: {title: 'headline', section: 'section', passed: 'factCheck.passed', printed: 'printedAt'},
    prepare: ({title, section, passed, printed}) => ({
      title,
      subtitle: [section, printed ? 'printed' : passed === false ? 'failed fact-check' : null]
        .filter(Boolean)
        .join(' · '),
    }),
  },
})
