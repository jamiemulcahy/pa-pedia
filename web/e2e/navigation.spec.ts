import { test, expect } from '@playwright/test'
import { FACTIONS, waitForFactionLoad } from './helpers'

test.describe('Navigation', () => {
  test('can navigate to a faction and see units', async ({ page }) => {
    await page.goto('/')

    // Click the Test Base Game faction card
    await page.locator(`a[href="/faction/${FACTIONS.BASE_GAME.id}"]`).click()

    // Should be on the faction detail page
    await expect(page).toHaveURL(`/faction/${FACTIONS.BASE_GAME.id}`)
    await expect(page.getByRole('heading', { name: FACTIONS.BASE_GAME.name })).toBeVisible()

    // Should display a unit count
    await waitForFactionLoad(page)
  })

  test('can navigate to a unit detail page', async ({ page }) => {
    await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)

    // Wait for units to load
    await waitForFactionLoad(page)

    // Click the first unit link
    const firstUnitLink = page
      .locator(`a[href^="/faction/${FACTIONS.BASE_GAME.id}/unit/"]`)
      .first()
    await expect(firstUnitLink).toBeVisible()
    const href = await firstUnitLink.getAttribute('href')
    await firstUnitLink.click()

    // Should be on the unit detail page
    await expect(page).toHaveURL(href!)
  })

  test('can navigate back to home from faction page', async ({ page }) => {
    await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
    await expect(
      page.getByRole('heading', { name: FACTIONS.BASE_GAME.name })
    ).toBeVisible()

    // Click the PA-PEDIA header link to go home
    await page.locator('header').getByRole('link').first().click()

    await expect(page).toHaveURL('/')
  })

  test('can navigate to All factions view', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Browse all factions').click()
    await expect(page).toHaveURL('/faction')
  })

  test('direct URL navigation works for faction page', async ({ page }) => {
    await page.goto(`/faction/${FACTIONS.FACTION.id}`)

    await expect(
      page.getByRole('heading', { name: FACTIONS.FACTION.name })
    ).toBeVisible()
    await waitForFactionLoad(page)
  })

  test('direct URL navigation works for unit page', async ({ page }) => {
    await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)

    await expect(page.getByRole('heading', { name: 'Test Tank' })).toBeVisible()
  })

  test('browser back/forward works', async ({ page }) => {
    // Start at home
    await page.goto('/')
    await expect(page.getByText(FACTIONS.BASE_GAME.name).first()).toBeVisible()

    // Navigate to faction
    await page.locator(`a[href="/faction/${FACTIONS.BASE_GAME.id}"]`).click()
    await expect(page).toHaveURL(`/faction/${FACTIONS.BASE_GAME.id}`)

    // Go back
    await page.goBack()
    await expect(page).toHaveURL('/')

    // Go forward
    await page.goForward()
    await expect(page).toHaveURL(`/faction/${FACTIONS.BASE_GAME.id}`)
  })
})
