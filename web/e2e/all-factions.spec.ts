import { test, expect } from '@playwright/test'
import { FACTIONS, waitForFactionLoad } from './helpers'

test.describe('All Factions view', () => {
  test('shows heading and units from multiple factions', async ({ page }) => {
    await page.goto('/faction')

    // Should show "All" heading
    await expect(page.getByRole('heading', { name: 'All' })).toBeVisible()

    // Wait for loading to complete
    await waitForFactionLoad(page)

    // Should mention multiple factions
    await expect(page.getByText(/from \d+ factions/i)).toBeVisible()
  })

  test('search works across all factions', async ({ page }) => {
    await page.goto('/faction')
    await waitForFactionLoad(page)

    // Search for a TestFaction unit
    const searchInput = page.getByLabel('Search units by name')
    await searchInput.click()
    await page.keyboard.type('Heavy Tank')

    // Should find the TestFaction unit
    await expect(page.locator('[class*="option"]', { hasText: 'Test Faction Heavy Tank' })).toBeVisible()
  })

  test('clicking unit navigates with correct faction ID', async ({ page }) => {
    await page.goto('/faction')
    await waitForFactionLoad(page)

    // Click a unit from TestBaseGame
    const unitLink = page.locator(`a[href*="/unit/test_tank"]`).first()
    if (await unitLink.isVisible()) {
      await unitLink.click()

      // URL should include the correct faction ID
      await expect(page).toHaveURL(new RegExp(`/faction/${FACTIONS.BASE_GAME.id}`))
      await expect(page).toHaveURL(/\/unit\/test_tank/)
    }
  })
})
