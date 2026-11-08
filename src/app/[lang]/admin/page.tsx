import { notFound } from 'next/navigation'
import { AdminDashboard } from '@/components/AdminDashboard'
import { Language, languages } from '@/types'

export default async function AdminPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!languages.includes(lang as Language)) notFound()
  return <AdminDashboard language={lang as Language} />
}
