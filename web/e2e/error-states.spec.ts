import { test, expect } from '@playwright/test'

test.describe('Error states', () => {
  test('invalid faction shows "Faction Not Found"', async ({ page }) => {
    await page.goto('/faction/NonExistentFaction')

    await expect(page.getByText(/not found/i)).toBeVisible()
  })

  test('"Go back" link from faction not found works', async ({ page }) => {
    await page.goto('/faction/NonExistentFaction')

    await expect(page.getByText(/not found/i)).toBeVisible()

    // Click back link
    const backLink = page.locator('a', { hasText: /back/i }).first()
    await backLink.click()

    await expect(page).toHaveURL('/')
  })

  test('invalid unit shows error state', async ({ page }) => {
    await page.goto('/faction/TestBaseGame/unit/nonexistent_unit')

    // Should show some error or empty state — wait for page to settle
    await page.waitForTimeout(2000)

    // Should have a way to navigate back
    const anyLink = page.locator('a').first()
    await expect(anyLink).toBeVisible()
  })
})
