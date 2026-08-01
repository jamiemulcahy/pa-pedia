import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Privacy } from '../Privacy'
import { renderWithProviders } from '@/tests/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.join(__dirname, '..', '..')

/**
 * Storage keys the privacy page deliberately does not list.
 *
 * `pa-pedia-view-mode` is the pre-migration preferences key: usePreferences
 * reads it once, folds it into `pa-pedia-preferences` and removes it, so it
 * never persists on a visitor's device and there is nothing to disclose.
 */
const UNDOCUMENTED_KEYS = new Set(['pa-pedia-view-mode'])

/** Every `pa-pedia-*` storage key literal declared anywhere under src/. */
function findStorageKeysInSource(): string[] {
  const keys = new Set<string>()

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'tests') continue
        walk(full)
        continue
      }
      if (!/\.tsx?$/.test(entry.name)) continue
      // Skip the page under test, or it would trivially satisfy itself.
      if (full.endsWith(path.join('pages', 'Privacy.tsx'))) continue

      const source = fs.readFileSync(full, 'utf-8')
      for (const match of source.matchAll(/['"`](pa-pedia-[a-z-]+)['"`]/g)) {
        keys.add(match[1])
      }
    }
  }

  walk(SRC_DIR)
  return [...keys]
}

describe('Privacy', () => {
  it('renders the page heading', () => {
    renderWithProviders(<Privacy />)
    expect(screen.getByRole('heading', { level: 1, name: /privacy/i })).toBeInTheDocument()
  })

  it('states the core position: no cookies, accounts, ads or tracking', () => {
    renderWithProviders(<Privacy />)
    const summary = screen.getByText(/does not use cookies/i)
    expect(summary).toBeInTheDocument()
    expect(summary.textContent).toMatch(/does not require an account/i)
    expect(summary.textContent).toMatch(/no advertising or cross-site tracking/i)
  })

  it('discloses the third parties that receive any visitor data', () => {
    renderWithProviders(<Privacy />)
    expect(screen.getByText(/Cloudflare Web Analytics/)).toBeInTheDocument()
    expect(screen.getByText(/reports? is sent to Sentry/i)).toBeInTheDocument()
  })

  it('tells visitors how to erase what is held on their device', () => {
    renderWithProviders(<Privacy />)
    expect(screen.getByText(/clearing site data/i)).toBeInTheDocument()
  })

  /**
   * The disclosure is only truthful while it matches the code. A new cache or
   * preference key added without a matching entry here is an undisclosed store
   * on the visitor's device, which is exactly what the page exists to prevent.
   */
  it('documents every pa-pedia storage key used in the app', () => {
    const { container } = renderWithProviders(<Privacy />)
    const pageText = container.textContent ?? ''

    const expected = findStorageKeysInSource().filter(k => !UNDOCUMENTED_KEYS.has(k))

    // Guards the scanner itself: if it silently matched nothing, the assertion
    // below would pass while checking nothing at all.
    expect(expected.length).toBeGreaterThan(0)

    const undocumented = expected.filter(key => !pageText.includes(key))
    expect(undocumented).toEqual([])
  })
})
