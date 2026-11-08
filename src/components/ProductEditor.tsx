'use client'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { Language, languages, Product } from '@/types'
import { t } from '@/lib/i18n'
import { ui } from '@/lib/ui-copy'
import { productSchema, saveProduct, uploadPhoto, validatePhoto } from '@/lib/catalog'
import { ZodError } from 'zod'

interface Props {
  product: Product
  language: Language
  onClose: () => void
  onSaved: (product: Product) => void
}
interface Photo {
  url: string
  file?: File
}
export function ProductEditor({ product, language, onClose, onSaved }: Props) {
  const words = t(language)
  const [draft, setDraft] = useState(product)
  const [photos, setPhotos] = useState<Photo[]>(product.images.map((url) => ({ url })))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const urls = useRef<string[]>([])
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
    const allocated = urls.current
    return () => {
      allocated.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])
  const addPhotos = (files: FileList | null) => {
    if (!files || busy) return
    try {
      const selected = Array.from(files)
      if (photos.length + selected.length > 8) throw new Error('PHOTO_INVALID')
      selected.forEach(validatePhoto)
      const added = selected.map((file) => {
        const url = URL.createObjectURL(file)
        urls.current.push(url)
        return { file, url }
      })
      setPhotos((previous) => [...previous, ...added])
      setError('')
    } catch {
      setError(ui(language, 'photoInvalid'))
    }
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (!photos.length) throw new Error('PHOTO_INVALID')
      productSchema.parse({
        ...draft,
        images: photos.map((photo) => (photo.file ? 'https://placeholder.invalid/pending.jpg' : photo.url)),
      })
      // Preserve successfully uploaded URLs on a failed save so retry does not upload twice.
      const uploaded: Photo[] = []
      for (const photo of photos) {
        const url = photo.file ? await uploadPhoto(photo.file) : photo.url
        uploaded.push({ url })
        setPhotos([...uploaded, ...photos.slice(uploaded.length)])
      }
      const result = await saveProduct({ ...draft, images: uploaded.map((photo) => photo.url) })
      onSaved(result)
    } catch (cause) {
      setError(
        cause instanceof ZodError
          ? ui(language, 'validation')
          : cause instanceof Error && cause.message === 'PHOTO_INVALID'
            ? ui(language, 'photoInvalid')
            : ui(language, 'error'),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <dialog
      className='product-editor'
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      aria-labelledby='editor-title'
    >
      <form onSubmit={save} className='northx-form' data-lenis-prevent>
        <div className='editor-heading'>
          <h2 id='editor-title'>{words.edit}</h2>
          <button type='button' disabled={busy} onClick={onClose} aria-label={words.close}>
            ×
          </button>
        </div>
        {error && (
          <p role='alert' className='form-error'>
            {error}
          </p>
        )}
        <fieldset disabled={busy} className='editor-fields'>
          {languages.map((lang) => (
            <div key={lang} className='translation-fields'>
              <label>
                {ui(language, 'name')} · {lang.toUpperCase()}
                <input
                  required
                  maxLength={120}
                  value={draft.title[lang]}
                  onChange={(event) => setDraft({ ...draft, title: { ...draft.title, [lang]: event.target.value } })}
                />
              </label>
              <label>
                {ui(language, 'description')} · {lang.toUpperCase()}
                <textarea
                  maxLength={2000}
                  rows={3}
                  value={draft.description[lang]}
                  onChange={(event) =>
                    setDraft({ ...draft, description: { ...draft.description, [lang]: event.target.value } })
                  }
                />
              </label>
            </div>
          ))}
          <div className='editor-columns'>
            <label>
              {ui(language, 'price')}
              <input
                type='number'
                required
                min={0}
                max={2147483647}
                step={1}
                value={draft.price}
                onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })}
              />
            </label>
            <label>
              {ui(language, 'category')}
              <input
                required
                maxLength={80}
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              />
            </label>
          </div>
          <label className='stock-toggle'>
            <input
              type='checkbox'
              checked={draft.isStock}
              onChange={(event) => setDraft({ ...draft, isStock: event.target.checked })}
            />
            {draft.isStock ? words.stock : words.soldOut}
          </label>
          <div
            className={`photo-drop ${dragging ? 'dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              addPhotos(event.dataTransfer.files)
            }}
          >
            <label>
              {ui(language, 'photos')}
              <span>{ui(language, 'photoHint')}</span>
              <input
                type='file'
                multiple
                accept='image/jpeg,image/png,image/webp'
                onChange={(event) => {
                  addPhotos(event.target.files)
                  event.target.value = ''
                }}
              />
            </label>
            <label className='camera-upload'>
              {ui(language, 'camera')}
              <input
                type='file'
                accept='image/*'
                capture='environment'
                onChange={(event) => {
                  addPhotos(event.target.files)
                  event.target.value = ''
                }}
              />
            </label>
          </div>
          <div className='photo-gallery'>
            {photos.map((photo, index) => (
              <div key={photo.url}>
                <img src={photo.url} alt={ui(language, 'preview')} />
                <button type='button' onClick={() => setPhotos(photos.filter((_, i) => i !== index))}>
                  {ui(language, 'remove')}
                </button>
                <button
                  type='button'
                  disabled={index === 0}
                  onClick={() => setPhotos([photo, ...photos.filter((_, i) => i !== index)])}
                >
                  {ui(language, 'primary')}
                </button>
              </div>
            ))}
          </div>
          <fieldset className='size-field'>
            <legend>{words.size}</legend>
            <div className='size-picker'>
              {Array.from({ length: 11 }, (_, i) => i + 36).map((size) => (
                <button
                  type='button'
                  key={size}
                  aria-pressed={draft.sizes.includes(size)}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      sizes: draft.sizes.includes(size)
                        ? draft.sizes.filter((entry) => entry !== size)
                        : [...draft.sizes, size].sort((a, b) => a - b),
                    })
                  }
                >
                  {size}
                </button>
              ))}
            </div>
            <div className='size-shortcuts'>
              <button
                type='button'
                onClick={() => setDraft({ ...draft, sizes: Array.from({ length: 11 }, (_, i) => i + 36) })}
              >
                {ui(language, 'allSizes')}
              </button>
              <button type='button' onClick={() => setDraft({ ...draft, sizes: [] })}>
                {ui(language, 'clear')}
              </button>
            </div>
          </fieldset>
        </fieldset>
        <div className='editor-footer'>
          <button type='button' disabled={busy} onClick={onClose}>
            {words.close}
          </button>
          <button type='submit' disabled={busy || !draft.sizes.length || !photos.length} className='checkout-button'>
            {busy ? ui(language, 'working') : words.save}
          </button>
        </div>
      </form>
    </dialog>
  )
}
