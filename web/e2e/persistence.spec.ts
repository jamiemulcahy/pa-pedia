import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { FACTIONS, waitForFactionLoad } from './helpers'

// Each test gets its own fresh browser context to isolate localStorage
test.describe('LocalStorage persistence', () => {
  let context: BrowserContext
  let page: Page

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext()
    page = await context.newPage()
  })

  test.afterEach(async () => {
    await context.close()
  })

  test('fresh context uses default list view mode', async () => {
    await page.goto(`http://localhost:5174/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    // Default view mode is list → toggle says "Switch to grid view"
    await expect(page.getByLabel('Switch to grid view')).toBeVisible()
  })

  test('inaccessible units hidden by default', async () => {
    await page.goto(`http://localhost:5174/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    await expect(page.getByText('Test Mine')).not.toBeVisible()
  })

  test('view mode persists across page reload', async () => {
    await page.goto(`http://localhost:5174/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    const toggle = page.getByLabel(/Switch to (grid|table|list) view/)
    await toggle.click()
    const afterClick = await toggle.getAttribute('aria-label')

    // Wait for the 300ms debounced localStorage save to flush
    await page.waitForTimeout(400)

    await page.reload()
    await waitForFactionLoad(page)

    const afterReload = await page.getByLabel(/Switch to (grid|table|list) view/).getAttribute('aria-label')
    expect(afterReload).toEqual(afterClick)
  })

  test('show inaccessible preference persists across reload', async () => {
    await page.goto(`http://localhost:5174/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    await page.getByLabel(/Show \d+ inaccessible unit/).click()
    await expect(page.getByText('Test Mine')).toBeVisible()

    // Wait for debounced localStorage save
    await page.waitForTimeout(400)

    await page.reload()
    await waitForFactionLoad(page)

    await expect(page.getByText('Test Mine')).toBeVisible()
  })

  test('view mode persists across navigation', async () => {
    await page.goto(`http://localhost:5174/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    const toggle = page.getByLabel(/Switch to (grid|table|list) view/)
    await toggle.click()
    const afterClick = await toggle.getAttribute('aria-label')

    // Wait for debounced localStorage save before navigating
    await page.waitForTimeout(400)
    await page.goto(`http://localhost:5174/faction/${FACTIONS.FACTION.id}`)
    await waitForFactionLoad(page)

    const otherLabel = await page.getByLabel(/Switch to (grid|table|list) view/).getAttribute('aria-label')
    expect(otherLabel).toEqual(afterClick)
  })
})
