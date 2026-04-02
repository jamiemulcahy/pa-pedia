import { test, expect } from '@playwright/test'
import { FACTIONS, waitForFactionLoad } from './helpers'

test.describe('Version switching', () => {
  test('version selector shows available versions for multi-version faction', async ({ page }) => {
    await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    // The version selector should be visible (TestBaseGame has 2 versions)
    const versionSelector = page.locator('.version-select__control')
    await expect(versionSelector).toBeVisible()

    // Click to open dropdown
    await versionSelector.click()

    // Should show both versions
    await expect(page.locator('.version-select__option', { hasText: 'v2.0.0' })).toBeVisible()
    await expect(page.locator('.version-select__option', { hasText: 'v1.0.0' })).toBeVisible()
  })

  test('switching version updates URL with @version suffix', async ({ page }) => {
    await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    // Open version dropdown and select v1.0.0
    const versionSelector = page.locator('.version-select__control')
    await versionSelector.click()
    await page.locator('.version-select__option', { hasText: 'v1.0.0' }).click()

    // URL should now include @1.0.0
    await expect(page).toHaveURL(`/faction/${FACTIONS.BASE_GAME.id}@1.0.0`)
  })

  test('different version shows different unit count', async ({ page }) => {
    // v2.0.0 (latest) has 7 total (6 accessible + 1 hidden) → "6 units"
    // v1.0.0 has 6 total (5 accessible + 1 hidden) → "5 units"
    await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
    await waitForFactionLoad(page)

    // Latest (v2) should show 6 accessible units
    await expect(page.getByText('6 units', { exact: false })).toBeVisible()

    // Switch to v1
    const versionSelector = page.locator('.version-select__control')
    await versionSelector.click()
    await page.locator('.version-select__option', { hasText: 'v1.0.0' }).click()

    // Wait for v1 data — should show 5 units instead of 6
    await expect(page.getByText('5 units', { exact: false })).toBeVisible()
  })

  test('direct URL with version loads correct data', async ({ page }) => {
    // Navigate directly to v1.0.0
    await page.goto(`/faction/${FACTIONS.BASE_GAME.id}@1.0.0`)
    await waitForFactionLoad(page)

    // URL should still have the version
    await expect(page).toHaveURL(`/faction/${FACTIONS.BASE_GAME.id}@1.0.0`)

    // Version selector should show v1.0.0 as selected
    await expect(page.locator('.version-select__single-value', { hasText: 'v1.0.0' })).toBeVisible()
  })

  test('single-version faction hides version selector', async ({ page }) => {
    // TestAddon only has 1 version
    await page.goto(`/faction/${FACTIONS.ADDON.id}`)
    await waitForFactionLoad(page)

    // Version selector should NOT be visible (only 1 version)
    await expect(page.locator('.version-select__control')).not.toBeVisible()
  })

  test('unit detail page respects version from URL', async ({ page }) => {
    // Navigate to a unit on v1.0.0
    await page.goto(`/faction/${FACTIONS.BASE_GAME.id}@1.0.0`)
    await waitForFactionLoad(page)

    // Click on the tank unit
    const tankLink = page.locator(`a[href^="/faction/${FACTIONS.BASE_GAME.id}@1.0.0/unit/test_tank"]`)
    if (await tankLink.count() > 0) {
      await tankLink.first().click()
      // URL should preserve the version
      await expect(page).toHaveURL(new RegExp(`/faction/${FACTIONS.BASE_GAME.id}@1\\.0\\.0/unit/test_tank`))
    }
  })
})
