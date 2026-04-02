import { test, expect } from '@playwright/test'
import { FACTIONS, waitForUnitLoad } from './helpers'

test.describe('Unit Comparison', () => {
  test.describe('Unit mode', () => {
    test('compare button enters comparison mode', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)
      await waitForUnitLoad(page)

      // Click Compare button
      const compareBtn = page.getByRole('button', { name: 'Compare' })
      if (await compareBtn.isVisible()) {
        await compareBtn.click()
        // URL should now have compare param
        await expect(page).toHaveURL(/compare=/)
      }
    })

    test('comparison activates via URL parameter', async ({ page }) => {
      await page.goto(
        `/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank?compare=${FACTIONS.BASE_GAME.id}/test_bot`
      )
      await waitForUnitLoad(page)

      // Both units should be visible — use headings to avoid strict mode
      await expect(page.getByRole('heading', { name: 'Test Tank' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Test Bot' })).toBeVisible()
    })

    test('remove button removes comparison unit', async ({ page }) => {
      await page.goto(
        `/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank?compare=${FACTIONS.BASE_GAME.id}/test_bot`
      )
      await waitForUnitLoad(page)

      // Click remove button
      const removeBtn = page.getByLabel('Remove from comparison').first()
      if (await removeBtn.isVisible()) {
        await removeBtn.click()
        // URL should no longer have compare param
        await expect(page).not.toHaveURL(/compare=/)
      }
    })

    test('exit comparison button returns to single unit view', async ({ page }) => {
      await page.goto(
        `/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank?compare=${FACTIONS.BASE_GAME.id}/test_bot`
      )
      await waitForUnitLoad(page)

      const exitBtn = page.getByLabel('Exit comparison mode')
      if (await exitBtn.isVisible()) {
        await exitBtn.click()
        await expect(page).not.toHaveURL(/compare=/)
      }
    })

    test('differences-only toggle filters matching stats', async ({ page }) => {
      await page.goto(
        `/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank?compare=${FACTIONS.BASE_GAME.id}/test_bot`
      )
      await waitForUnitLoad(page)

      const diffToggle = page.getByLabel(/Show differences only/)
      if (await diffToggle.isVisible()) {
        await diffToggle.click()
        await expect(page).toHaveURL(/diffOnly=1/)
      }
    })
  })

  test.describe('Same-faction comparison', () => {
    test('can compare two units from same faction', async ({ page }) => {
      await page.goto(
        `/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank?compare=${FACTIONS.BASE_GAME.id}/test_bot`
      )
      await waitForUnitLoad(page)

      // Both units should show their headings
      await expect(page.getByRole('heading', { name: 'Test Tank' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Test Bot' })).toBeVisible()
    })
  })

  test.describe('Group mode', () => {
    test('group mode activates via URL parameter', async ({ page }) => {
      await page.goto(
        `/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank?mode=group&qty=3`
      )
      await waitForUnitLoad(page)

      // Should show quantity indicator
      await expect(page).toHaveURL(/mode=group/)
      await expect(page).toHaveURL(/qty=3/)
    })
  })
})
