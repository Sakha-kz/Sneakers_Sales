import { z } from 'zod'
import { database } from './supabase'

const localized = (minimum = 0, maximum = 2000) =>
  z.object({
    ru: z.string().trim().min(minimum).max(maximum),
    kk: z.string().trim().min(minimum).max(maximum),
    en: z.string().trim().min(minimum).max(maximum),
  })
export const productSchema = z.object({
  id: z.string().uuid(),
  title: localized(1, 120),
  description: localized(),
  price: z.number().int().min(0).max(2147483647),
  images: z
    .array(
      z
        .string()
        .url()
        .refine((url) => /^https?:\/\//.test(url)),
    )
    .max(8),
  sizes: z
    .array(z.number().int().min(36).max(46))
    .min(1)
    .max(11)
    .refine((sizes) => new Set(sizes).size === sizes.length),
  category: z.string().trim().min(1).max(80),
  isStock: z.boolean(),
  isFeatured: z.boolean(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
})
export const settingsSchema = z.object({
  whatsapp_number: z.string().regex(/^\+?[0-9]{7,15}$/),
  store_address: localized(0, 500),
})
export async function requireAdmin() {
  const db = database()
  const {
    data: { user },
    error,
  } = await db.auth.getUser()
  if (error || !user) throw new Error('AUTH_REQUIRED')
  const access = await db.from('admin_access').select('user_id').eq('user_id', user.id).maybeSingle()
  if (access.error || !access.data) throw new Error('ACCESS_DENIED')
  return db
}
export async function saveProduct(value: unknown) {
  const product = productSchema.parse(value)
  const db = await requireAdmin()
  const { data, error } = await db.from('products').upsert(product).select().single()
  if (error) throw error
  return productSchema.parse(data)
}
export async function deleteProduct(id: string) {
  const db = await requireAdmin()
  const { data, error } = await db.from('products').delete().eq('id', z.string().uuid().parse(id)).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('NOT_FOUND')
}
export function validatePhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5242880 || file.size === 0)
    throw new Error('PHOTO_INVALID')
}
export async function uploadPhoto(file: File) {
  validatePhoto(file)
  const db = await requireAdmin()
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
  const path = crypto.randomUUID() + '.' + extension
  const { error } = await db.storage
    .from('product-images')
    .upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return db.storage.from('product-images').getPublicUrl(path).data.publicUrl
}
export async function saveSettings(phone: string, address: Record<string, string>) {
  const value = settingsSchema.parse({ whatsapp_number: phone.replace(/[\s()-]/g, ''), store_address: address })
  const db = await requireAdmin()
  const { data, error } = await db
    .from('settings')
    .upsert({ id: 1, ...value })
    .select()
    .single()
  if (error) throw error
  return settingsSchema.parse(data)
}
