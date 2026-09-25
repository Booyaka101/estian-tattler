import Link from 'next/link'
import {Masthead} from '@/components/Masthead'
import {getPaper, slug} from '@/lib/tattler'

export default async function FrontPage() {
  const {colony, stories} = await getPaper()
  const [lead, ...rest] = stories
  return (
    <main className="paper">
      <Masthead colony={colony} edition={lead?.edition} />
      {lead ? (
        <Link href={`/story/${slug(lead)}/`} className="splash">
          {lead.section && <span className="section">{lead.section}</span>}
          <h1>{lead.headline}</h1>
          {lead.dek && <p className="dek">{lead.dek}</p>}
          <span className="more">{lead.claims} claims, all sourced. Read it.</span>
        </Link>
      ) : (
        <p className="empty">Nothing has cleared the desk yet.</p>
      )}
      {rest.length > 0 && (
        <section className="columns">
          {rest.map((story) => (
            <Link key={story._id} href={`/story/${slug(story)}/`} className="card">
              {story.section && <span className="section">{story.section}</span>}
              <h2>{story.headline}</h2>
              {story.dek && <p className="dek">{story.dek}</p>}
            </Link>
          ))}
        </section>
      )}
      <HowItWorks recordCount={colony.recordCount} firstRecordDay={colony.firstRecordDay} />
    </main>
  )
}

function HowItWorks({recordCount, firstRecordDay}: {recordCount: number; firstRecordDay: number}) {
  return (
    <footer className="colophon">
      <h3>How this paper works</h3>
      <p>
        The newsroom is a Sanity dataset of {recordCount} records pulled out of one RimWorld save: tales, letters,
        messages and pawn-to-pawn talk. The save forgets anything older than day {firstRecordDay}, so nothing earlier
        can be printed.
      </p>
      <p>
        A Claude reporter drafts each story with only a search tool over those records. Every sentence is either a
        claim that cites records or an aside with no names and no numbers in it. A fact-checker, which is plain code and
        not a model, rejects any claim naming a pawn or quoting a number its receipts don&apos;t contain. Failed drafts
        go back to the reporter, three strikes and the story is spiked. An editor still has to approve it in Sanity
        Studio before the press runs.
      </p>
    </footer>
  )
}
