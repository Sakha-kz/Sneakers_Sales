import { notFound } from 'next/navigation'
import { Landing } from '@/components/Landing'
import { Language, languages } from '@/types'

export function generateStaticParams() {
  return languages.map((lang) => ({ lang }))
}
export default async function LanguageHome({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!languages.includes(lang as Language)) notFound()
  return <Landing language={lang as Language} />
}
