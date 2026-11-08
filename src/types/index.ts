export const languages = ['en', 'ru', 'kk'] as const
export type Language = (typeof languages)[number]

export type LocalizedText = Record<Language, string>

export interface Product {
  id: string
  title: LocalizedText
  description: LocalizedText
  price: number
  images: string[]
  sizes: number[]
  category: string
  isStock: boolean
  isFeatured: boolean
  color: string
}

export interface CartItem {
  productId: string
  size: number
  quantity: number
}

export type UserRole = 'GUEST' | 'USER' | 'ADMIN'
