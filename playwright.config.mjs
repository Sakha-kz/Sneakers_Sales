import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'
const edge = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  workers: 1,
  expect: { timeout: 12000 },
  use: {
    baseURL: 'http://localhost:3100',
    headless: true,
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: existsSync(edge) ? edge : undefined, args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run dev -- --port 3100',
    url: 'http://localhost:3100/ru',
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      NEXT_BUILD_DIR: '.next-qa',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'qa-public-placeholder',
    },
  },
})
