import {notFound} from 'next/navigation'
import {Masthead} from '@/components/Masthead'
import {ReceiptLine, StoryBody} from '@/components/StoryBody'
import {getPaper, getStory, receiptsOf, slug} from '@/lib/tattler'

export const dynamicParams = false

export async function generateStaticParams() {
  const {stories} = await getPaper()
  return stories.map((story) => ({id: slug(story)}))
}

export default async function StoryPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params
  const [{colony}, story] = await Promise.all([getPaper(), getStory(`story-${id}`)])
  if (!story) notFound()
  const receipts = receiptsOf(story)
  return (
    <main className="paper">
      <Masthead colony={colony} edition={story.edition} />
      <article className="story">
        {story.section && <span className="section">{story.section}</span>}
        <h1>{story.headline}</h1>
        {story.dek && <p className="dek">{story.dek}</p>}
        <p className="byline">
          By {story.byline}. Edition {story.edition}.
        </p>
        <StoryBody story={story} />
        <details className="evidence">
          <summary>All {receipts.length} records this story cites</summary>
          <ol>
            {receipts.map((r) => (
              <li key={r._id}>
                <ReceiptLine r={r} />
              </li>
            ))}
          </ol>
        </details>
      </article>
    </main>
  )
}
