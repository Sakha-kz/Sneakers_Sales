'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Minus, Plus, ShoppingBag, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SmoothScroll } from '@/components/SmoothScroll'
import { ui } from '@/lib/ui-copy'
import { t } from '@/lib/i18n'
import { buildWhatsAppLink, useCartStore, useCatalogStore, useSettingsStore } from '@/lib/store'
import { cn, formatPrice } from '@/lib/utils'
import { Language, Product, languages } from '@/types'

const SneakerScene = dynamic(() => import('@/components/canvas/SneakerScene').then((module) => module.SneakerScene), {
  ssr: false,
})

function Header({ language, onCart }: { language: Language; onCart: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const itemCount = useCartStore((state) => state.items.reduce((total, item) => total + item.quantity, 0))
  const words = t(language)
  return (
    <header className='site-header'>
      <Link className='brand' href={`/${language}`} aria-label='NorthX home'>
        <svg width='32' height='24' viewBox='0 0 32 24' aria-hidden='true'>
          <path d='M2 21 12 3 18 13 23 5 30 21H2Z' fill='none' stroke='currentColor' strokeWidth='2' />
        </svg>
        NorthX<span>®</span>
      </Link>
      <div className='header-actions'>
        <div className='language-switcher' aria-label={ui(language, 'languages')}>
          {languages.map((entry) => (
            <Link
              key={entry}
              aria-current={entry === language ? 'page' : undefined}
              className={cn('language', entry === language && 'active')}
              href={`/${entry}`}
            >
              {entry}
            </Link>
          ))}
        </div>
        <a className='header-shop' href='#collection'>
          {language === 'ru' ? 'В магазин ↓' : language === 'kk' ? 'Дүкенге ↓' : 'Shop ↓'}
        </a>
        <button className='bag-button' onClick={onCart} aria-label={words.cart}>
          <ShoppingBag size={17} />
          <span>{mounted ? itemCount : 0}</span>
        </button>
      </div>
    </header>
  )
}

function ProductCard({
  product,
  language,
  onAdd,
}: {
  product: Product
  language: Language
  onAdd: (size: number) => void
}) {
  const words = t(language)
  const [selected, setSize] = useState(product.sizes[0])
  const [photo, setPhoto] = useState(0)
  const [added, setAdded] = useState(false)
  const size = product.sizes.includes(selected) ? selected : product.sizes[0]
  useEffect(() => {
    if (!added) return
    const timer = setTimeout(() => setAdded(false), 1600)
    return () => clearTimeout(timer)
  }, [added])
  return (
    <motion.article
      className='product-card'
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.35 }}
    >
      <div className='product-image'>
        <img
          src={product.images[photo] || product.images[0] || '/product-placeholder.svg'}
          alt={product.title[language]}
          loading='lazy'
          decoding='async'
          onError={(event) => {
            event.currentTarget.onerror = null
            event.currentTarget.src = '/product-placeholder.svg'
          }}
        />
        <span className={cn('stock-badge', !product.isStock && 'sold')}>
          {product.isStock ? words.stock : words.soldOut}
        </span>
      </div>
      {product.images.length > 1 && (
        <div className='product-gallery-nav' aria-label={ui(language, 'photos')}>
          {product.images.map((src, index) => (
            <button
              key={src + index}
              aria-pressed={photo === index}
              aria-label={`${ui(language, 'preview')} ${index + 1}`}
              onClick={() => setPhoto(index)}
            >
              <img src={src} alt='' loading='lazy' />
            </button>
          ))}
        </div>
      )}
      <div className='product-copy'>
        <div>
          <p className='product-category'>{product.category}</p>
          <h3>{product.title[language]}</h3>
          <p>{product.description[language]}</p>
        </div>
        <strong>{formatPrice(product.price, language)}</strong>
      </div>
      <div className='product-bottom'>
        <div className='size-control' aria-label={`${words.size} ${product.title[language]}`}>
          {product.sizes.map((value) => (
            <button
              key={value}
              onClick={() => setSize(value)}
              aria-pressed={value === size}
              className={cn(value === size && 'selected')}
            >
              {value}
            </button>
          ))}
        </div>
        <button
          aria-label={words.add}
          className='add-button'
          onClick={() => {
            onAdd(size)
            setAdded(true)
          }}
          disabled={!product.isStock || !size}
        >
          <span aria-live='polite'>{added ? ui(language, 'added') : words.add}</span>
          <Plus size={16} />
        </button>
      </div>
    </motion.article>
  )
}

function CartDrawer({ open, onClose, language }: { open: boolean; onClose: () => void; language: Language }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const words = t(language)
  const items = useCartStore((state) => state.items)
  const change = useCartStore((state) => state.setQuantity)
  const remove = useCartStore((state) => state.removeItem)
  const products = useCatalogStore((state) => state.products)
  const error = useCatalogStore((state) => state.error)
  const loading = useCatalogStore((state) => state.loading)
  const phone = useSettingsStore((state) => state.whatsappNumber)
  const detailed = items.map((item) => ({ item, product: products.find((entry) => entry.id === item.productId) }))
  const unavailable = detailed.some(({ item, product }) => !product?.isStock || !product.sizes.includes(item.size))
  const total = detailed.reduce((sum, { item, product }) => sum + (product?.price ?? 0) * item.quantity, 0)
  const canCheckout = items.length > 0 && !!phone && !error && !loading && !unavailable
  useEffect(() => {
    if (!open) return
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      active?.focus()
    }
  }, [open])
  const checkout = () => {
    if (canCheckout) window.open(buildWhatsAppLink(language, items, products, phone), '_blank', 'noopener,noreferrer')
  }
  return (
    <dialog
      ref={dialog}
      className='cart-modal'
      aria-label={words.cart}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      data-lenis-prevent
    >
      <AnimatePresence onExitComplete={() => dialog.current?.close()}>
        {open && (
          <motion.div
            className='cart-shell'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <button className='backdrop' aria-label={words.close} onClick={onClose} tabIndex={-1} />
            <motion.aside
              className='cart-drawer'
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              <div className='drawer-head'>
                <div>
                  <p className='eyebrow'>{words.checkout}</p>
                  <h2>{words.cart}</h2>
                </div>
                <button autoFocus className='icon-button' onClick={onClose} aria-label={words.close}>
                  <X />
                </button>
              </div>
              {items.length === 0 ? (
                <div className='empty-cart'>
                  <ShoppingBag size={30} />
                  <p>{words.empty}</p>
                  <button className='text-button' onClick={onClose}>
                    {words.continue}
                    <ArrowDownRight size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <div className='cart-lines'>
                    {detailed.map(({ item, product }) => {
                      const available = product?.isStock && product.sizes.includes(item.size)
                      return (
                        <div className='cart-line' key={`${item.productId}-${item.size}`}>
                          <img src={product?.images[0] || '/product-placeholder.svg'} alt='' />
                          <div>
                            <h3>{product?.title[language] || ui(language, 'missingProduct')}</h3>
                            <p>
                              {words.size} {item.size}
                              {product && ` · ${formatPrice(product.price, language)}`}
                            </p>
                            {!available && <p className='cart-warning'>{ui(language, 'unavailable')}</p>}
                            <div className='quantity'>
                              <button
                                onClick={() => change(item.productId, item.size, item.quantity - 1)}
                                aria-label={ui(language, 'decrease')}
                              >
                                <Minus size={14} />
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                disabled={!available || item.quantity >= 99}
                                onClick={() => change(item.productId, item.size, item.quantity + 1)}
                                aria-label={ui(language, 'increase')}
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                className='remove'
                                aria-label={ui(language, 'remove')}
                                onClick={() => remove(item.productId, item.size)}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className='cart-footer'>
                    <div>
                      <span>{words.subtotal}</span>
                      <strong>{formatPrice(total, language)}</strong>
                    </div>
                    {(!phone || !!error) && <p role='status'>{ui(language, 'noCheckout')}</p>}
                    <button className='checkout-button' disabled={!canCheckout} onClick={checkout}>
                      {words.order}
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                </>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </dialog>
  )
}

export function Landing({ language }: { language: Language }) {
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  const words = t(language)
  const [cartOpen, setCartOpen] = useState(false)
  const [filter, setFilter] = useState('All')
  const [storyStage, setStoryStage] = useState(1)
  const products = useCatalogStore((state) => state.products)
  const add = useCartStore((state) => state.addItem)
  const address = useSettingsStore((state) => state.storeAddress[language])
  const catalogError = useCatalogStore((state) => state.error)
  const loading = useCatalogStore((state) => state.loading)
  const categories = ['All', ...Array.from(new Set(products.map((product) => product.category)))]
  const visible = filter === 'All' ? products : products.filter((product) => product.category === filter)
  return (
    <MotionConfig reducedMotion='user'>
      <SmoothScroll>
        <ErrorBoundary fallback={<div className='scene-fallback' aria-hidden='true' />}>
          <SneakerScene language={language} onStageChange={setStoryStage} />
        </ErrorBoundary>
        <div className='noise' />
        <main className='landing-main'>
          <Header language={language} onCart={() => setCartOpen(true)} />
          <section id='story' data-stage={storyStage} aria-label={ui(language, 'story')}>
            {[0, 2, 4].map((index, step) => (
              <section
                key={index}
                className={`story-stage stage-${['one', 'two', 'three'][step]}`}
                aria-hidden={storyStage !== step + 1}
              >
                <p>0{step + 1} / 03 · NORTHX</p>
                {step === 0 ? <h1>{words.stage[index]}</h1> : <h2>{words.stage[index]}</h2>}
                <p>{step === 0 ? words.heroBody : step === 1 ? words.annotation1 : words.explore}</p>
              </section>
            ))}
          </section>
          <section className='catalog' id='collection'>
            {(catalogError || loading) && (
              <div className='catalog-status'>
                <p role='status'>
                  {loading
                    ? language === 'ru'
                      ? 'Загрузка…'
                      : language === 'kk'
                        ? 'Жүктелуде…'
                        : 'Loading…'
                    : language === 'ru'
                      ? 'Каталог временно недоступен'
                      : language === 'kk'
                        ? 'Каталог уақытша қолжетімсіз'
                        : 'Catalog temporarily unavailable'}
                </p>
                {catalogError && (
                  <button onClick={() => window.dispatchEvent(new Event('northx:refresh'))}>
                    {language === 'ru' ? 'Повторить' : language === 'kk' ? 'Қайталау' : 'Retry'}
                  </button>
                )}
              </div>
            )}
            <div className='catalog-heading'>
              <div>
                <p className='eyebrow'>NORTHX / SNEAKERS & FOOTWEAR</p>
                <h2>{words.shopTitle}</h2>
                <p>{words.shopBody}</p>
              </div>
              <div className='catalog-count'>
                {visible.length.toString().padStart(2, '0')}
                <span> / {ui(language, 'pairs')}</span>
              </div>
            </div>
            <div className='filters' aria-label={ui(language, 'filters')}>
              {categories.map((category) => (
                <button
                  key={category}
                  className={cn(filter === category && 'active')}
                  onClick={() => setFilter(category)}
                >
                  {category === 'All' ? words.all : category}
                </button>
              ))}
            </div>
            {!loading && !catalogError && visible.length === 0 && (
              <p className='empty-catalog'>{ui(language, 'emptyCatalog')}</p>
            )}
            <div className='product-grid'>
              {visible.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  language={language}
                  onAdd={(size) => add(product.id, size)}
                />
              ))}
            </div>
          </section>
          <footer>
            <span>
              NorthX® ·{' '}
              <a className='model-credit' href='/models/ATTRIBUTION.txt'>
                3D: Shopify · CC BY 4.0
              </a>
            </span>
            <span>{address || 'Sneakers & Footwear'}</span>
            <Link href={`/${language}/admin`}>
              {words.admin} <ArrowUpRight size={13} />
            </Link>
          </footer>
        </main>
        <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} language={language} />
      </SmoothScroll>
    </MotionConfig>
  )
}
