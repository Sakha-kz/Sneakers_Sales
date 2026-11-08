import { test, expect } from '@playwright/test'

const product = {
  id: '41c8da5b-18ef-40b3-b3bc-7599a5c3c256',
  title: { ru: 'NorthX Test', kk: 'NorthX Test', en: 'NorthX Test' },
  description: { ru: 'Описание модели', kk: 'Үлгі сипаттамасы', en: 'Model description' },
  price: 45000,
  images: ['http://localhost:3100/product-placeholder.svg'],
  sizes: [38, 40, 42],
  category: 'Lifestyle',
  isStock: true,
  isFeatured: false,
  color: '#ffffff',
}
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=',
  'base64',
)
async function backend(page, initial = [structuredClone(product)]) {
  const state = {
    products: initial,
    settings: { id: 1, whatsapp_number: '+77001234567', store_address: { ru: 'Алматы', kk: 'Алматы', en: 'Almaty' } },
    admin: true,
    badPassword: false,
    offline: false,
    uploads: 0,
  }
  const user = {
    id: '20260919-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'owner@example.test',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  }
  const jwt = [
    { alg: 'HS256', typ: 'JWT' },
    { sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 },
    'signature',
  ]
    .map((x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url'))
    .join('.')
  await page.route('http://127.0.0.1:54329/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname,
      method = request.method()
    const reply = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
        body: JSON.stringify(body),
      })
    if (method === 'OPTIONS') return reply({})
    if (state.offline) return reply({ message: 'Test outage' }, 503)
    if (path.includes('/auth/v1/token'))
      return state.badPassword
        ? reply({ message: 'Invalid credentials' }, 400)
        : reply({
            access_token: jwt,
            refresh_token: 'test-refresh',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer',
            user,
          })
    if (path.includes('/auth/v1/user')) return reply(user)
    if (path.includes('/auth/v1/logout')) return reply({})
    if (path.includes('/admin_access')) return reply(state.admin ? { user_id: user.id } : null)
    if (path.includes('/storage/v1/object/public/'))
      return route.fulfill({ status: 200, contentType: 'image/png', body: png })
    if (path.includes('/storage/v1/object/')) {
      state.uploads++
      return reply({ Key: path.split('/object/')[1] })
    }
    if (path.endsWith('/products')) {
      if (method === 'POST') {
        const p = request.postDataJSON()
        state.products = [p, ...state.products.filter((x) => x.id !== p.id)]
        return reply(p)
      }
      if (method === 'DELETE') {
        const id = url.searchParams.get('id')?.slice(3)
        state.products = state.products.filter((p) => p.id !== id)
        return reply([{ id }])
      }
      return reply(state.products)
    }
    if (path.endsWith('/settings')) {
      if (method === 'POST') state.settings = request.postDataJSON()
      return reply(state.settings)
    }
    return reply({})
  })
  await page.routeWebSocket('**/realtime/**', (socket) =>
    socket.onMessage((message) => {
      const data = JSON.parse(message)
      if (data[3] === 'phx_join' || data[3] === 'heartbeat')
        socket.send(JSON.stringify([data[0], data[1], data[2], 'phx_reply', { status: 'ok', response: {} }]))
    }),
  )
  return state
}
async function login(page) {
  await page.goto('/ru/admin')
  await page.getByLabel('Email').fill('owner@example.test')
  await page.getByLabel('Пароль').fill('test-password')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
}
test('administrator signs in, edits photos, translations, sizes, price and settings', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const db = await backend(page, [])
  await login(page)
  await page.getByRole('button', { name: 'Новый кроссовок' }).click()
  const editor = page.getByRole('dialog')
  await expect(editor).toBeVisible()
  for (const lang of ['RU', 'KK', 'EN']) {
    await editor.getByLabel(`Название · ${lang}`, { exact: true }).fill(`NorthX ${lang}`)
    await editor.getByLabel(`Описание · ${lang}`, { exact: true }).fill(`Description ${lang}`)
  }
  await editor.getByLabel('Цена, ₸').fill('52000')
  await editor.getByLabel('Категория', { exact: true }).fill('Lifestyle')
  await editor
    .locator('input[type=file]')
    .first()
    .setInputFiles([
      { name: 'one.png', mimeType: 'image/png', buffer: png },
      { name: 'two.png', mimeType: 'image/png', buffer: png },
    ])
  await expect(editor.locator('.photo-gallery img')).toHaveCount(2)
  await editor.getByRole('button', { name: 'Главное фото' }).last().click()
  await editor.getByRole('button', { name: 'Снять выбор', exact: true }).click()
  await editor.getByRole('button', { name: '38', exact: true }).click()
  await editor.getByRole('button', { name: '42', exact: true }).click()
  await editor.locator('button[type=submit]').click()
  await expect(editor).not.toBeVisible()
  await expect(page.getByRole('status')).toContainText('Товар сохранён')
  expect(db.uploads).toBe(2)
  expect(db.products[0].sizes).toEqual([38, 42])
  expect(db.products[0].description.kk).toBe('Description KK')
  await page.getByRole('button', { name: 'Изменить', exact: true }).click()
  await editor.getByLabel('Цена, ₸').fill('49000')
  await editor.locator('button[type=submit]').click()
  await expect(editor).not.toBeVisible()
  expect(db.products[0].price).toBe(49000)
  expect(db.uploads).toBe(2)
  await page.locator('.stock-toggle input').uncheck()
  await expect(page.getByRole('status')).toContainText('Наличие обновлено')
  expect(db.products[0].isStock).toBe(false)
  await page.getByLabel('Номер WhatsApp').fill('+7 (700) 765-43-21')
  await page.getByLabel('Адрес магазина · ru').fill('Алматы, NorthX')
  await page.locator('.settings-panel').getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Настройки сохранены')
  expect(db.settings.whatsapp_number).toBe('+77007654321')
  await page.screenshot({ path: 'artifacts/admin-mobile.png', fullPage: true })
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.locator('.inventory-list article')).toHaveCount(0)
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible()
})
test('invalid sign-in and non-administrator cannot open inventory', async ({ page }) => {
  const db = await backend(page)
  db.badPassword = true
  await login(page)
  await expect(page.locator('.toast-error')).toBeVisible()
  await expect(page.locator('.inventory')).toHaveCount(0)
  db.badPassword = false
  db.admin = false
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.locator('.toast-error')).toContainText('нет прав')
  await expect(page.locator('.inventory')).toHaveCount(0)
})
test('cart quantities, WhatsApp details and stale stock are handled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const db = await backend(page)
  await page.goto('/ru')
  await page.locator('.product-card').getByRole('button', { name: '40', exact: true }).click()
  await page.getByRole('button', { name: 'В корзину', exact: true }).click()
  await page.getByRole('button', { name: 'Корзина', exact: true }).click()
  await page.getByRole('button', { name: 'Увеличить количество' }).click()
  await expect(page.locator('.quantity span')).toHaveText('2')
  const link = await page.getByRole('button', { name: 'Заказать в WhatsApp' }).getAttribute('href')
  expect(link).toContain('https://wa.me/77001234567?text=')
  expect(decodeURIComponent(link)).toContain('40 × 2')
  db.products[0].isStock = false
  await page.evaluate(() => window.dispatchEvent(new Event('northx:refresh')))
  await expect(page.getByRole('button', { name: 'Заказать в WhatsApp' })).toBeDisabled()
  await expect(page.locator('.cart-warning')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Корзина', exact: true }).click()
  await expect(page.locator('.quantity span')).toHaveText('2')
  db.products = []
  await page.evaluate(() => window.dispatchEvent(new Event('northx:refresh')))
  await expect(page.locator('.cart-line h3')).toHaveText('Товар удалён из каталога')
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.locator('.empty-cart')).toBeVisible()
})
test('all languages work and reduced motion omits WebGL', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await backend(page)
  await page.goto('/ru')
  await page.locator('.language-switcher').getByRole('link', { name: 'kk', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'kk')
  await expect(page.getByRole('button', { name: 'Себетке қосу', exact: true })).toBeVisible()
  await page.locator('.language-switcher').getByRole('link', { name: 'en', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('button', { name: 'Add to bag', exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})
test('catalog outage has a working retry', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const db = await backend(page)
  db.offline = true
  await page.goto('/ru')
  await expect(page.locator('.catalog-status')).toContainText('временно недоступен')
  db.offline = false
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(page.locator('.product-card')).toHaveCount(1)
  await expect(page.locator('.catalog-status')).toHaveCount(0)
})
for (const [label, width, height] of [
  ['desktop', 1440, 900],
  ['mobile', 390, 844],
  ['small', 320, 568],
  ['landscape', 844, 390],
  ['tablet', 820, 1180],
  ['wide', 2560, 1080],
]) {
  test(`3D, reverse scroll and catalog handoff: ${label}`, async ({ page }) => {
    test.setTimeout(120000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    await page.setViewportSize({ width, height })
    await backend(page)
    await page.addInitScript(() => {
      window.__draws = 0
      for (const kind of [WebGLRenderingContext, WebGL2RenderingContext])
        for (const name of ['drawElements', 'drawArrays']) {
          const original = kind.prototype[name]
          kind.prototype[name] = function (...args) {
            window.__draws++
            return original.apply(this, args)
          }
        }
    })
    await page.goto('/ru')
    await page.waitForSelector('canvas')
    await expect(page.getByRole('button', { name: /dev tools/i })).toHaveCount(0)
    await expect(page.locator('[data-nextjs-dev-tools-button]')).toHaveCount(0)
    await page.waitForTimeout(2000)
    await expect.poll(() => page.evaluate(() => window.__draws)).toBeGreaterThan(0)
    await expect(page.getByRole('button', { name: 'Песочный', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Песочный', exact: true }).click()
    const rail = page.locator('.colorway-switcher')
    const railBox = await rail.boundingBox()
    expect(railBox.height).toBeGreaterThan(railBox.width)
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(width)
    await page.screenshot({ path: `artifacts/${label}-closed.png` })
    await page.evaluate((h) => window.scrollTo(0, h * 0.4), height)
    await page.waitForTimeout(1300)
    await page.screenshot({ path: `artifacts/${label}-opening.png` })
    await page.evaluate((h) => window.scrollTo(0, h * 1.05), height)
    await page.waitForTimeout(1300)
    await expect(page.locator('#story')).toHaveAttribute('data-stage', '2')
    await expect(page.getByRole('button', { name: 'Песочный', exact: true })).toHaveAttribute('aria-pressed','true')
    await page.screenshot({ path: `artifacts/${label}-shoe.png` })
    if (label === 'mobile' || label === 'desktop') {
      await page.evaluate(h => window.scrollTo(0, h * .888), height)
      await page.waitForTimeout(1300)
      await page.screenshot({ path: `artifacts/${label}-quarter-turn.png` })
    }
    await page.evaluate((h) => window.scrollTo(0, h * 1.65), height)
    await page.waitForTimeout(1300)
    await page.getByRole('button', { name: 'Песочный', exact: true }).click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `artifacts/${label}-colorway.png` })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(1300)
    await expect(page.locator('#story')).toHaveAttribute('data-stage', '1')
    await expect(page.getByRole('button', { name: 'Песочный', exact: true })).toHaveAttribute('aria-pressed','true')
    if(label === 'mobile') {
      await page.reload()
      await expect(page.getByRole('button', { name: 'Песочный', exact: true })).toHaveAttribute('aria-pressed','true')
    }
    await page.locator('.header-shop').click()
    await page.waitForTimeout(1800)
    expect(await page.locator('#collection').evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(10)
    await expect(page.locator('.canvas-shell')).toHaveCSS('visibility', 'hidden')
    const before = await page.evaluate(() => window.__draws)
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => window.__draws)).toBe(before)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `artifacts/${label}-catalog.png` })
    expect(errors).toEqual([])
  })
}
