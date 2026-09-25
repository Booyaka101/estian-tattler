import type {Metadata} from 'next'
import './tattler.css'

export const metadata: Metadata = {
  title: 'The Estian Tattler',
  description: 'A tabloid for one RimWorld colony. Every claim links to the save file record it came from.',
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
