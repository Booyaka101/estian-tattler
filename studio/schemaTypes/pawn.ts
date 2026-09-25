import {defineArrayMember, defineField, defineType} from 'sanity'

export const pawn = defineType({
  name: 'pawn',
  title: 'Pawn',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({name: 'name', type: 'string', description: 'As of the last record that mentions them.'}),
    defineField({name: 'shortName', type: 'string'}),
    defineField({
      name: 'formerNames',
      type: 'array',
      of: [defineArrayMember({type: 'string'})],
      description: 'Other names the save has on file, usually from a marriage.',
    }),
    defineField({name: 'aliases', type: 'array', of: [defineArrayMember({type: 'string'})]}),
    defineField({name: 'gender', type: 'string'}),
    defineField({name: 'age', type: 'number'}),
    defineField({name: 'relationNote', type: 'string'}),
    defineField({name: 'everColonist', type: 'boolean'}),
    defineField({name: 'thingId', type: 'string'}),
  ],
  preview: {
    select: {title: 'name', note: 'relationNote', colonist: 'everColonist'},
    prepare: ({title, note, colonist}) => ({title, subtitle: note ?? (colonist ? 'Colonist' : 'Outsider')}),
  },
})
