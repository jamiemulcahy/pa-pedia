import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { FACTIONS, waitForFactionLoad } from './helpers'

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

    // Default view mode should be list → toggle says "Switch to grid view"
    await expect(page.getByLabel('Switch to grid view')).toBeVisible()
  })

  test('inaccessible units hidden by default', async () => {
    await page.goto(`http://localhost:5174/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    await expect(page.getByText('Test Mine')).not.toBeVisible()
  })

  test('toggling inaccessible units shows them', async () => {
    await page.goto(`http://localhost:5174/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    await page.getByLabel(/Show \d+ inaccessible unit/).click()
    await expect(page.getByText('Test Mine')).toBeVisible()
  })

  test('view mode can be changed', async () => {
    await page.goto(`http://localhost:5174/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    const toggle = page.getByLabel(/Switch to (grid|table|list) view/)
    const before = await toggle.getAttribute('aria-label')
    await toggle.click()
    const after = await toggle.getAttribute('aria-label')

    expect(after).not.toEqual(before)
  })
})
