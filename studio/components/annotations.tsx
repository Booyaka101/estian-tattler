import {useEffect, useState} from 'react'
import {Box, Stack, Text} from '@sanity/ui'
import {Tooltip} from '@sanity/ui/tooltip'
import {useClient, type BlockAnnotationProps} from 'sanity'

type Receipt = {_id: string; text?: string; label?: string; colonyDay?: number; kind?: string}

function useReceipts(ids: string[]) {
  const client = useClient({apiVersion: '2025-02-19'})
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const key = ids.join(',')
  useEffect(() => {
    if (!ids.length) return setReceipts([])
    client
      .fetch<Receipt[]>('*[_id in $ids]{_id, text, label, colonyDay, kind} | order(colonyDay asc)', {ids})
      .then(setReceipts, () => setReceipts([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key])
  return receipts
}

/** Claims get a green underline, and hovering one shows the records it stands on. */
export function ClaimAnnotation(props: BlockAnnotationProps) {
  const ids = ((props.value as {records?: {_ref: string}[]})?.records ?? []).map((r) => r._ref)
  const receipts = useReceipts(ids)
  const content = (
    <Box padding={3} style={{maxWidth: 420}}>
      <Stack gap={3}>
        {receipts.length === 0 && <Text size={1}>No receipts yet.</Text>}
        {receipts.map((r) => (
          <Text key={r._id} size={1}>
            <strong>Day {r.colonyDay}</strong>, {r.kind}: {r.label ? `${r.label}. ` : ''}
            {r.text}
          </Text>
        ))}
      </Stack>
    </Box>
  )
  return (
    <Tooltip content={content} placement="top" portal>
      <span
        style={{
          textDecoration: 'underline',
          textDecorationColor: ids.length ? '#2e7d32' : '#c62828',
          textDecorationThickness: 2,
          textUnderlineOffset: 3,
        }}
      >
        {props.renderDefault(props)}
      </span>
    </Tooltip>
  )
}

/** Asides are the paper's opinion, set apart so nobody mistakes them for reporting. */
export function AsideAnnotation(props: BlockAnnotationProps) {
  return <span style={{fontStyle: 'italic', color: '#8d6e00'}}>{props.renderDefault(props)}</span>
}
