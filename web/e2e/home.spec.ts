import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test('loads and displays faction cards', async ({ page }) => {
    await page.goto('/')

    // All 5 factions should be visible
    await expect(page.getByText('MLA').first()).toBeVisible()
    await expect(page.getByText('Legion').first()).toBeVisible()
    await expect(page.getByText('Bugs').first()).toBeVisible()
    await expect(page.getByText('Exiles').first()).toBeVisible()
    await expect(page.getByText('Second Wave').first()).toBeVisible()
  })

  test('shows "All" card linking to /faction', async ({ page }) => {
    await page.goto('/')

    const allCard = page.getByLabel('Browse all factions')
    await expect(allCard).toBeVisible()
    await expect(allCard).toHaveAttribute('href', '/faction')
  })

  test('shows ADDON badge on Second Wave', async ({ page }) => {
    await page.goto('/')

    // Find the Second Wave card and verify it has the ADDON badge
    const secondWaveCard = page.locator('a[href="/faction/Second-Wave"]')
    await expect(secondWaveCard).toBeVisible()
    await expect(secondWaveCard.getByText('ADDON')).toBeVisible()
  })

  test('shows community links', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: /GG Leaderboards/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /PA Discord/i })).toBeVisible()
  })
})
