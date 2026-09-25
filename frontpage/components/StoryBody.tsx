import {PortableText, type PortableTextComponents} from '@portabletext/react'
import type {Receipt, Story} from '@/lib/tattler'

function ReceiptLine({r}: {r: Receipt}) {
  return (
    <span className="receipt-line">
      <b>
        Day {r.colonyDay}, {String(r.hour).padStart(2, '0')}h
      </b>{' '}
      <span className="kind">{r.kind}</span> {r.label ? `${r.label}. ` : ''}
      {r.text}
    </span>
  )
}

const components: PortableTextComponents = {
  marks: {
    claim: ({children, value}) => (
      <span className="claim" tabIndex={0}>
        {children}
        <span className="receipts" role="tooltip">
          {((value?.receipts ?? []) as Receipt[]).map((r) => (
            <ReceiptLine key={r._id} r={r} />
          ))}
        </span>
      </span>
    ),
    aside: ({children}) => <em className="aside">{children}</em>,
  },
}

export function StoryBody({story}: {story: Story}) {
  return (
    <div className="body">
      <PortableText value={story.body} components={components} />
    </div>
  )
}

export {ReceiptLine}
