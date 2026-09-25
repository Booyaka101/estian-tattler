import {defineArrayMember, defineField, defineType} from 'sanity'

// One thing the save file can prove happened. Written by ingest/parse_save.py, never by hand.
export const record = defineType({
  name: 'record',
  title: 'Record',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({
      name: 'kind',
      type: 'string',
      options: {list: ['tale', 'letter', 'message', 'talk']},
      description: 'Tales are what pawns remember, letters and messages are what the game told the player, talks come from the play log.',
    }),
    defineField({name: 'text', type: 'text', rows: 3}),
    defineField({name: 'label', type: 'string'}),
    defineField({name: 'colonyDay', type: 'number'}),
    defineField({name: 'hour', type: 'number'}),
    defineField({name: 'pawns', type: 'array', of: [defineArrayMember({type: 'reference', to: [{type: 'pawn'}]})]}),
    defineField({name: 'def', type: 'string', description: "The game's def for the tale, letter or interaction."}),
    defineField({name: 'subjectDef', type: 'string'}),
    defineField({name: 'subjectLabel', type: 'string'}),
    defineField({name: 'letterClass', type: 'string'}),
    defineField({name: 'tick', type: 'number'}),
    defineField({name: 'sourceId', type: 'string', description: 'ID of the entry inside the save.'}),
  ],
  orderings: [{title: 'Colony day', name: 'day', by: [{field: 'tick', direction: 'asc'}]}],
  preview: {
    select: {text: 'text', label: 'label', day: 'colonyDay', kind: 'kind'},
    prepare: ({text, label, day, kind}) => ({title: label || text, subtitle: `Day ${day} · ${kind}`}),
  },
})
