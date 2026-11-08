'use client'

import { z } from 'zod'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { CartItem, Language, Product } from '@/types'
import { copy } from '@/lib/i18n'
import { whatsappDigits } from '@/lib/utils'

interface SettingsState {
  whatsappNumber: string
  storeName: string
  storeAddress: Record<Language, string>
}
export const useSettingsStore = create<SettingsState>(() => ({
  whatsappNumber: '',
  storeName: 'NorthX',
  storeAddress: { ru: '', kk: '', en: '' },
}))
interface CatalogState {
  products: Product[]
  error: string
  loading: boolean
}
export const useCatalogStore = create<CatalogState>(() => ({ products: [], error: '', loading: true }))

const storedCart = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        size: z.number().int().min(36).max(46),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .max(200),
})
interface CartState {
  items: CartItem[]
  addItem: (productId: string, size: number) => void
  removeItem: (productId: string, size: number) => void
  setQuantity: (productId: string, size: number, quantity: number) => void
  clear: () => void
}
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (productId, size) =>
        set((state) => {
          const exists = state.items.find((item) => item.productId === productId && item.size === size)
          return {
            items: exists
              ? state.items.map((item) =>
                  item === exists ? { ...item, quantity: Math.min(99, item.quantity + 1) } : item,
                )
              : [...state.items, { productId, size, quantity: 1 }],
          }
        }),
      removeItem: (productId, size) =>
        set((state) => ({ items: state.items.filter((item) => item.productId !== productId || item.size !== size) })),
      setQuantity: (productId, size, quantity) =>
        set((state) => ({
          items:
            quantity < 1
              ? state.items.filter((item) => item.productId !== productId || item.size !== size)
              : state.items.map((item) =>
                  item.productId === productId && item.size === size
                    ? { ...item, quantity: Math.min(99, Math.floor(quantity)) }
                    : item,
                ),
        })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'sneakers-cart-v1',
      merge: (stored, current) => {
        const result = storedCart.safeParse(stored)
        return { ...current, items: result.success ? result.data.items : [] }
      },
    },
  ),
)

export function buildWhatsAppLink(language: Language, items: CartItem[], products: Product[], phone: string): string {
  const labels = copy[language]
  const rows = items.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId)
    return product
      ? [
          `• ${product.title[language]} — ${labels.size}: ${item.size} × ${item.quantity} = ${(product.price * item.quantity).toLocaleString()} ₸`,
          product.images[0],
        ]
      : []
  })
  const total = items.reduce(
    (sum, item) => sum + (products.find((entry) => entry.id === item.productId)?.price ?? 0) * item.quantity,
    0,
  )
  return `https://wa.me/${whatsappDigits(phone)}?text=${encodeURIComponent([labels.orderIntro, '', ...rows, '', `${labels.total}: ${total.toLocaleString()} ₸`].join('\n'))}`
}
