import type { Metadata } from 'next'
import './globals.css'
import './northx.css'
import { CatalogSync } from '@/components/CatalogSync'

export const metadata: Metadata = { title: 'NorthX — Sneakers & Footwear', description: 'NorthX / Sneakers & Footwear' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <CatalogSync />
        {children}
      </body>
    </html>
  )
}
