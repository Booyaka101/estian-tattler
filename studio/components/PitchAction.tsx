import {useState} from 'react'
import {ComposeIcon} from '@sanity/icons/Compose'
import {useClient, type DocumentActionComponent} from 'sanity'
import {useRouter} from 'sanity/router'

/** "Pitch a story" on any record: opens a new story with the record as its first lead. */
export const PitchAction: DocumentActionComponent = ({id, published}) => {
  const client = useClient({apiVersion: '2025-02-19'})
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const record = published as {label?: string; text?: string} | null

  return {
    label: 'Pitch a story',
    icon: ComposeIcon,
    disabled: busy || !record,
    onHandle: async () => {
      setBusy(true)
      const storyId = `story-${Math.random().toString(36).slice(2, 10)}`
      const seed = (record?.label || record?.text || '').replace(/\s+/g, ' ')
      await client.create({
        _id: `drafts.${storyId}`,
        _type: 'story',
        headline: seed.length > 90 ? `${seed.slice(0, 87)}...` : seed,
        leads: [{_key: id.replace(/\W/g, ''), _type: 'reference', _ref: id}],
      })
      router.navigateIntent('edit', {id: storyId, type: 'story'})
    },
  }
}
