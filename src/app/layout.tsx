import localFont from 'next/font/local'
import type { Metadata } from 'next'
import './globals.css'
import './northx.css'
import { CatalogSync } from '@/components/CatalogSync'

const northxFont = localFont({
  src: '../../public/fonts/Montserrat.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-northx',
  fallback: ['Arial'],
  adjustFontFallback: 'Arial',
})

export const metadata: Metadata = { title: 'NorthX — Sneakers & Footwear', description: 'NorthX / Sneakers & Footwear' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body className={northxFont.variable}>
        <CatalogSync />
        {children}
      </body>
    </html>
  )
}
