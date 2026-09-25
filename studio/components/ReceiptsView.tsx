import {useEffect, useState} from 'react'
import {Badge, Box, Card, Flex, Heading, Stack, Text} from '@sanity/ui'
import {useClient} from 'sanity'
import type {UserViewComponent} from 'sanity/structure'
import type {Block, StoryInput, Verdict} from '../lib/factcheck'
import {checkWithMorgue, type Receipt} from '../lib/morgue'

type Checked = {verdict: Verdict; receipts: Map<string, Receipt>}

function Sentence({text, kind, receipts}: {text: string; kind: string; receipts: Receipt[]}) {
  return (
    <Flex gap={4} align="flex-start">
      <Box flex={3}>
        <Text size={2} style={{fontStyle: kind === 'aside' ? 'italic' : undefined}}>
          {text}
        </Text>
      </Box>
      <Stack flex={2} gap={2}>
        {kind === 'aside' && (
          <Text size={1} muted>
            Aside. The paper's opinion, no receipt needed.
          </Text>
        )}
        {kind === 'none' && (
          <Text size={1} style={{color: '#c62828'}}>
            No receipt and not marked as an aside.
          </Text>
        )}
        {receipts.map((r) => (
          <Card key={r._id} padding={2} radius={2} tone="positive" border>
            <Text size={1}>
              <strong>
                Day {r.colonyDay}, {r.hour}h
              </strong>{' '}
              {r.kind}: {r.label ? `${r.label}. ` : ''}
              {r.text}
            </Text>
          </Card>
        ))}
      </Stack>
    </Flex>
  )
}

/** The story laid out sentence by sentence, each one next to the records it stands on. */
export const ReceiptsView: UserViewComponent = ({document}) => {
  const story = document.displayed as StoryInput & {byline?: string}
  const client = useClient({apiVersion: '2025-02-19'})
  const [checked, setChecked] = useState<Checked | null>(null)
  const rev = (document.displayed as {_rev?: string})._rev

  useEffect(() => {
    checkWithMorgue(client, story).then(setChecked, () => setChecked(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, rev])

  if (!checked) return <Box padding={4}><Text muted>Pulling the receipts...</Text></Box>
  const {verdict, receipts} = checked

  return (
    <Box padding={4}>
      <Stack gap={5}>
        <Stack gap={3}>
          <Flex gap={2} align="center">
            <Badge tone={verdict.passed ? 'positive' : 'critical'}>
              {verdict.passed ? 'Passes fact-check' : `${verdict.problems.length} problems`}
            </Badge>
            <Text size={1} muted>
              {verdict.claims} claims, {verdict.asides} asides, {receipts.size} records cited
            </Text>
          </Flex>
          <Heading size={3}>{story.headline}</Heading>
          {story.dek && <Text size={2} muted>{story.dek}</Text>}
          {story.byline && <Text size={1} muted>By {story.byline}</Text>}
        </Stack>
        {verdict.problems.length > 0 && (
          <Card padding={3} radius={2} tone="critical" border>
            <Stack gap={2}>
              {verdict.problems.map((p, i) => (
                <Text key={i} size={1}>
                  "{p.text}" {p.reason}.
                </Text>
              ))}
            </Stack>
          </Card>
        )}
        {(story.body ?? []).map((block: Block, i) => {
          const defs = new Map((block.markDefs ?? []).map((d) => [d._key, d]))
          return (
            <Stack key={i} gap={3}>
              {(block.children ?? [])
                .filter((span) => /[\p{L}\d]/u.test(span.text ?? ''))
                .map((span, j) => {
                  const mark = (span.marks ?? []).map((k) => defs.get(k)).find((d) => d?._type === 'claim' || d?._type === 'aside')
                  const cited = (mark?.records ?? []).map((r) => receipts.get(r._ref)).filter((r): r is Receipt => !!r)
                  return <Sentence key={j} text={span.text ?? ''} kind={mark?._type ?? 'none'} receipts={cited} />
                })}
            </Stack>
          )
        })}
      </Stack>
    </Box>
  )
}
