import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Pins the import order in main.tsx.
 *
 * `App.tsx` wraps the router with Sentry at module scope, and that wrapper is a
 * silent no-op unless `Sentry.init` has already run: it returns `Routes`
 * unchanged, and the only symptom is missing navigation transactions in a
 * dashboard nobody checks daily. ESM evaluates imports in source order, so the
 * side-effecting './instrument' import has to come before './App'.
 *
 * Asserting on source text is blunt, but the alternative is no protection at
 * all — reordering these imports breaks nothing that any other test can see.
 */
describe('main.tsx bootstrap order', () => {
  it('imports ./instrument before ./App', () => {
    const source = readFileSync(resolve(__dirname, '../main.tsx'), 'utf8')

    const instrumentAt = source.indexOf(`'./instrument'`)
    const appAt = source.indexOf(`'./App`)

    expect(instrumentAt).toBeGreaterThanOrEqual(0)
    expect(appAt).toBeGreaterThanOrEqual(0)
    expect(instrumentAt).toBeLessThan(appAt)
  })
})

/**
 * Pins the translation guard's wiring. Nothing else fails without it: the unit
 * and page tests exercise the guard and the components separately, and neither
 * loads main.tsx. See src/lib/translationGuard.ts.
 */
describe('main.tsx translation guard', () => {
  it('installs the guard before the first render', () => {
    const source = readFileSync(resolve(__dirname, '../main.tsx'), 'utf8')

    const guardAt = source.indexOf('installTranslationGuard()')
    const renderAt = source.indexOf('createRoot(')

    expect(guardAt).toBeGreaterThanOrEqual(0)
    expect(renderAt).toBeGreaterThanOrEqual(0)
    expect(guardAt).toBeLessThan(renderAt)
  })
})
