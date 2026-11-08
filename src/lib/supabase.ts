import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function isDatabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

let client: SupabaseClient | undefined
export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase: configure .env.local first')
  return (client ??= createClient(url, key))
}
