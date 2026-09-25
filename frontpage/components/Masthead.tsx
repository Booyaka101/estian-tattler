import Link from 'next/link'
import type {Colony} from '@/lib/tattler'

export function Masthead({colony, edition}: {colony: Colony; edition?: number}) {
  return (
    <header className="masthead">
      <div className="ears">
        <span>Colony Day {colony.currentDay}</span>
        <span>{edition ? `Edition ${edition}` : 'No edition yet'}</span>
        <span>{colony.modCount} mods loaded</span>
      </div>
      <Link href="/" className="nameplate">
        The Estian Tattler
      </Link>
      <div className="strap">
        Gossip for the {colony.name}. Every claim has a receipt. Hover it.
      </div>
    </header>
  )
}
