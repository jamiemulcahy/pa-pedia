import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('can navigate to a faction and see units', async ({ page }) => {
    await page.goto('/')

    // Click the MLA faction card
    await page.locator('a[href="/faction/MLA"]').click()

    // Should be on the faction detail page
    await expect(page).toHaveURL('/faction/MLA')
    await expect(page.getByRole('heading', { name: 'MLA' })).toBeVisible()

    // Should display a unit count
    await expect(page.getByText(/\d+ units/i)).toBeVisible()
  })

  test('can navigate to a unit detail page', async ({ page }) => {
    await page.goto('/faction/MLA')

    // Wait for units to load
    await expect(page.getByText(/\d+ units/i)).toBeVisible()

    // Click the first unit link
    const firstUnitLink = page.locator('a[href^="/faction/MLA/unit/"]').first()
    await expect(firstUnitLink).toBeVisible()
    const href = await firstUnitLink.getAttribute('href')
    await firstUnitLink.click()

    // Should be on the unit detail page
    await expect(page).toHaveURL(href!)
  })

  test('can navigate back to home from faction page', async ({ page }) => {
    await page.goto('/faction/MLA')
    await expect(page.getByRole('heading', { name: 'MLA' })).toBeVisible()

    // Click the PA-PEDIA header link to go home
    await page.locator('header').getByRole('link').first().click()

    await expect(page).toHaveURL('/')
  })
})
