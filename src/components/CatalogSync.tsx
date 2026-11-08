'use client'
import { useEffect } from 'react'
import { database } from '@/lib/supabase'
import { productSchema, settingsSchema } from '@/lib/catalog'
import { useCatalogStore, useSettingsStore } from '@/lib/store'
export function CatalogSync() {
  useEffect(() => {
    let alive = true
    let revision = 0
    const refresh = async (event?: Event) => {
      const ticket = ++revision
      if (event?.type === 'northx:refresh') useCatalogStore.setState({ loading: true, error: '' })
      try {
        const db = database()
        const [products, settings] = await Promise.all([
          db.from('products').select('*').order('created_at', { ascending: false }),
          db.from('settings').select('*').eq('id', 1).maybeSingle(),
        ])
        if (products.error) throw products.error
        if (settings.error) throw settings.error
        if (!alive || ticket !== revision) return
        useCatalogStore.setState({ products: productSchema.array().parse(products.data), error: '', loading: false })
        if (settings.data) {
          const value = settingsSchema.parse(settings.data)
          useSettingsStore.setState({ whatsappNumber: value.whatsapp_number, storeAddress: value.store_address })
        } else {
          useSettingsStore.setState({ whatsappNumber: '', storeAddress: { ru: '', kk: '', en: '' } })
        }
      } catch (error) {
        if (alive && ticket === revision)
          useCatalogStore.setState({
            loading: false,
            error: error instanceof Error ? error.message : 'Catalog unavailable',
          })
      }
    }
    void refresh()
    let cleanup = () => {}
    try {
      const db = database()
      const channel = db
        .channel('northx-catalog')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => void refresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => void refresh())
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void refresh()
        })
      cleanup = () => {
        void db.removeChannel(channel)
      }
    } catch {}
    window.addEventListener('online', refresh)
    window.addEventListener('northx:refresh', refresh)
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh()
    }, 15000)
    return () => {
      alive = false
      cleanup()
      clearInterval(timer)
      window.removeEventListener('online', refresh)
      window.removeEventListener('northx:refresh', refresh)
    }
  }, [])
  return null
}
