'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ZodError } from 'zod'
import { database, isDatabaseConfigured } from '@/lib/supabase'
import { requireAdmin, saveProduct, deleteProduct, saveSettings } from '@/lib/catalog'
import { useCatalogStore, useSettingsStore } from '@/lib/store'
import { Language, Product, languages } from '@/types'
import { t } from '@/lib/i18n'
import { ui } from '@/lib/ui-copy'
import { ProductEditor } from './ProductEditor'

export function AdminDashboard({ language }: { language: Language }) {
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  const words = t(language)
  const products = useCatalogStore((s) => s.products)
  const catalogError = useCatalogStore((s) => s.error)
  const settings = useSettingsStore()
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null)
  const [draft, setDraft] = useState<Product | null>(null)
  const configured = isDatabaseConfigured()
  useEffect(() => {
    if (!notice || notice.error) return
    const timer = setTimeout(() => setNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    if (!configured) {
      setChecking(false)
      return
    }
    let alive = true
    const verify = async () => {
      try {
        await requireAdmin()
        if (alive) setAuthorized(true)
      } catch {
        if (alive) {
          setAuthorized(false)
          setDraft(null)
        }
      } finally {
        if (alive) setChecking(false)
      }
    }
    void verify()
    const { data } = database().auth.onAuthStateChange(() => {
      setTimeout(() => void verify(), 0)
    })
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [configured])
  const run = async (action: () => Promise<void>, success: string) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setNotice(null)
    try {
      await action()
      window.dispatchEvent(new Event('northx:refresh'))
      setNotice({ text: success, error: false })
    } catch (error) {
      setNotice({ text: ui(language, error instanceof ZodError ? 'validation' : 'error'), error: true })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setNotice(null)
    void (async () => {
      try {
        const { error } = await database().auth.signInWithPassword({
          email: String(data.get('email')).trim(),
          password: String(data.get('password')),
        })
        if (error) throw error
        await requireAdmin()
        setAuthorized(true)
      } catch {
        setAuthorized(false)
        setNotice({ text: ui(language, 'denied'), error: true })
      } finally {
        lock.current = false
        setBusy(false)
      }
    })()
  }
  const edit = (product?: Product) =>
    setDraft(
      product ?? {
        id: crypto.randomUUID(),
        title: { ru: '', kk: '', en: '' },
        description: { ru: '', kk: '', en: '' },
        price: 0,
        sizes: [],
        images: [],
        category: 'Sneakers',
        isStock: true,
        isFeatured: false,
        color: '#ffffff',
      },
    )
  const updateLocal = (product: Product) =>
    useCatalogStore.setState((state) => ({
      products: state.products.some((entry) => entry.id === product.id)
        ? state.products.map((entry) => (entry.id === product.id ? product : entry))
        : [product, ...state.products],
    }))
  return (
    <main className='admin-page'>
      <header className='admin-header'>
        <Link href={'/' + language}>
          NorthX <small> / Sneakers & Footwear</small>
        </Link>
        <div>
          {languages.map((lang) => (
            <Link key={lang} aria-current={lang === language ? 'page' : undefined} href={'/' + lang + '/admin'}>
              {lang.toUpperCase()}
            </Link>
          ))}
          {authorized && (
            <button
              disabled={busy}
              onClick={() =>
                void run(
                  async () => {
                    const { error } = await database().auth.signOut()
                    if (error) throw error
                    setAuthorized(false)
                  },
                  ui(language, 'logout'),
                )
              }
            >
              {ui(language, 'logout')}
            </button>
          )}
        </div>
      </header>
      <AnimatePresence>
        {notice && (
          <motion.div
            className={'toast ' + (notice.error ? 'toast-error' : '')}
            role={notice.error ? 'alert' : 'status'}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <span>{notice.text}</span>
            <button onClick={() => setNotice(null)} aria-label={words.close}>
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {checking ? (
        <p>{ui(language, 'loading')}</p>
      ) : !authorized ? (
        <form className='northx-form admin-login' onSubmit={login}>
          <p className='eyebrow'>NORTHX / {words.admin}</p>
          <h1>{words.dashboard}</h1>
          {!configured && <p role='status'>{ui(language, 'setup')}</p>}
          <label>
            Email
            <input name='email' type='email' required autoComplete='username' />
          </label>
          <label>
            {ui(language, 'password')}
            <input name='password' type='password' required autoComplete='current-password' />
          </label>
          <button disabled={busy || !configured} className='checkout-button'>
            {ui(language, busy ? 'signingIn' : 'login')}
          </button>
        </form>
      ) : (
        <>
          <section className='inventory'>
            <div className='inventory-head'>
              <h1>{words.products}</h1>
              <button className='checkout-button' disabled={busy} onClick={() => edit()}>
                {words.newProduct}
              </button>
            </div>
            {catalogError && <p role='alert'>{ui(language, 'error')}</p>}
            {!products.length && !catalogError && <p>{ui(language, 'emptyCatalog')}</p>}
            <div className='inventory-list'>
              {products.map((product) => (
                <article key={product.id}>
                  <img
                    src={product.images[0] || '/product-placeholder.svg'}
                    alt={product.title[language]}
                    width={112}
                    height={80}
                  />
                  <div>
                    <h3>{product.title[language]}</h3>
                    <p>{product.price.toLocaleString()} ₸</p>
                    <label className='stock-toggle'>
                      <input
                        type='checkbox'
                        checked={product.isStock}
                        disabled={busy}
                        onChange={() =>
                          void run(
                            async () => {
                              updateLocal({ ...product, isStock: !product.isStock })
                              try {
                                updateLocal(await saveProduct({ ...product, isStock: !product.isStock }))
                              } catch (error) {
                                updateLocal(product)
                                throw error
                              }
                            },
                            ui(language, 'stockSaved'),
                          )
                        }
                      />
                      {product.isStock ? words.stock : words.soldOut}
                    </label>
                  </div>
                  <div>
                    <button disabled={busy} onClick={() => edit(product)}>
                      {words.edit}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(ui(language, 'deleteConfirm') + ' ' + product.title[language]))
                          void run(
                            async () => {
                              await deleteProduct(product.id)
                              useCatalogStore.setState((state) => ({
                                products: state.products.filter((entry) => entry.id !== product.id),
                              }))
                            },
                            ui(language, 'deleted'),
                          )
                      }}
                    >
                      {words.delete}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className='settings-panel'>
            <h2>{words.settings}</h2>
            <form
              className='northx-form'
              key={settings.whatsappNumber + JSON.stringify(settings.storeAddress)}
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                void run(
                  async () => {
                    const result = await saveSettings(String(data.get('phone')), {
                      ru: String(data.get('ru')),
                      kk: String(data.get('kk')),
                      en: String(data.get('en')),
                    })
                    useSettingsStore.setState({
                      whatsappNumber: result.whatsapp_number,
                      storeAddress: result.store_address,
                    })
                  },
                  ui(language, 'settingsSaved'),
                )
              }}
            >
              <label>
                {words.whatsapp}
                <input
                  name='phone'
                  defaultValue={settings.whatsappNumber}
                  required
                  type='tel'
                  placeholder='+77001234567'
                />
              </label>
              {languages.map((lang) => (
                <label key={lang}>
                  {ui(language, 'address')} · {lang}
                  <input name={lang} maxLength={500} defaultValue={settings.storeAddress[lang]} />
                </label>
              ))}
              <button disabled={busy}>{busy ? ui(language, 'working') : words.save}</button>
            </form>
          </section>
          {draft && (
            <ProductEditor
              key={draft.id}
              product={draft}
              language={language}
              onClose={() => setDraft(null)}
              onSaved={(product) => {
                updateLocal(product)
                setDraft(null)
                setNotice({ text: ui(language, 'saved'), error: false })
                window.dispatchEvent(new Event('northx:refresh'))
              }}
            />
          )}
        </>
      )}
    </main>
  )
}
