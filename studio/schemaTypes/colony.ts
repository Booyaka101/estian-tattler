import {defineField, defineType} from 'sanity'

export const colony = defineType({
  name: 'colony',
  title: 'Colony',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({name: 'name', type: 'string'}),
    defineField({name: 'gameVersion', type: 'string'}),
    defineField({name: 'modCount', type: 'number'}),
    defineField({name: 'currentDay', type: 'number', description: 'Days since landing when the save was made.'}),
    defineField({
      name: 'firstRecordDay',
      type: 'number',
      description: 'The save forgets old tales and letters. Nothing before this day can be proven.',
    }),
    defineField({name: 'recordCount', type: 'number'}),
  ],
})
