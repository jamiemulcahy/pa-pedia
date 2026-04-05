import { test, expect } from '@playwright/test'
import { FACTIONS, KNOWN_UNITS, waitForUnitLoad } from './helpers'

test.describe('Unit Detail page', () => {
  test.describe('Basic rendering', () => {
    test('displays unit name and description', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)
      await waitForUnitLoad(page)

      await expect(page.getByRole('heading', { name: 'Test Tank' })).toBeVisible()
      await expect(page.getByText('Light Tank', { exact: false })).toBeVisible()
    })

    test('displays Overview section with HP', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)
      await waitForUnitLoad(page)

      await expect(page.getByText('Overview')).toBeVisible()
      await expect(page.getByText('HP:')).toBeVisible()
      // v2.0.0 (latest) has health 300
      await expect(page.getByText(`${KNOWN_UNITS.tank.healthV2}`)).toBeVisible()
    })

    test('displays build cost in Overview', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)
      await waitForUnitLoad(page)

      await expect(page.getByText('Build cost:')).toBeVisible()
      await expect(page.getByText(`${KNOWN_UNITS.tank.buildCost} metal`)).toBeVisible()
    })

    test('displays weapon stats for combat units', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)
      await waitForUnitLoad(page)

      // Scroll down to see weapon/ammo sections
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(500)

      // Weapon data is shown with DPS, damage, ammo sections
      await expect(page.getByText('DPS').first()).toBeVisible()
    })

    test('displays Physics section', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)
      await waitForUnitLoad(page)

      await expect(page.getByText('Physics')).toBeVisible()
      await expect(page.getByText('Max speed:')).toBeVisible()
    })

    test('displays unit type tags', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)
      await waitForUnitLoad(page)

      const unitTypes = page.getByText('Unit Types')
      await unitTypes.scrollIntoViewIfNeeded()
      await expect(unitTypes).toBeVisible()
    })
  })

  test.describe('Factory units', () => {
    test('factory page shows built units', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_air_factory`)
      await waitForUnitLoad(page)

      // Scroll down to find the build relationships
      // The factory builds Test Fighter, Test Tank, Test Bot
      const fighterLink = page.locator('a', { hasText: 'Test Fighter' }).first()
      await fighterLink.scrollIntoViewIfNeeded()
      await expect(fighterLink).toBeVisible()
    })

    test('factory page shows build relationships', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_air_factory`)
      await waitForUnitLoad(page)

      // Scroll down to reveal build relationship sections
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(500)

      // Should show "Built By" section heading
      await expect(page.getByText('Built By').first()).toBeVisible()
    })
  })

  test.describe('Commander units', () => {
    test('commander shows weapon stats', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_commander`)
      await waitForUnitLoad(page)

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(500)

      // Commander has weapons — look for DPS stats
      await expect(page.getByText('DPS').first()).toBeVisible()
    })
  })

  test.describe('Per-layer DPS breakdown', () => {
    test('commander shows per-layer DPS when weapons target different layers', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_commander`)
      await waitForUnitLoad(page)

      // Commander has weapons targeting Land, Sea, Seafloor, and Air with different DPS per layer
      // Should show per-layer breakdown
      await expect(page.getByText('vs Land:')).toBeVisible()
      await expect(page.getByText('vs Air:')).toBeVisible()
      await expect(page.getByText('vs Seafloor:')).toBeVisible()
    })

    test('single-layer unit shows its target layer', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_fighter`)
      await waitForUnitLoad(page)

      // Fighter only targets Air — still shows layer so user knows what it can hit
      await expect(page.getByText('DPS:')).toBeVisible()
      await expect(page.getByText('vs Air:')).toBeVisible()
    })

    test('same-DPS-across-layers unit still shows per-layer breakdown', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)
      await waitForUnitLoad(page)

      // Tank targets Land and Sea — shows both layers
      await expect(page.getByText('DPS:')).toBeVisible()
      await expect(page.getByText('vs Land:')).toBeVisible()
      await expect(page.getByText('vs Sea:')).toBeVisible()
    })

    test('weapon sections show human-readable target layer names', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_commander`)
      await waitForUnitLoad(page)

      // Scroll to see weapon sections
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(500)

      // Weapon should show "Targets: Land, Sea, Seafloor" instead of raw names
      await expect(page.getByText('Land, Sea, Seafloor').first()).toBeVisible()
    })
  })

  test.describe('Breadcrumb navigation', () => {
    test('breadcrumb shows navigation area', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)
      await waitForUnitLoad(page)

      const breadcrumb = page.getByLabel('Unit navigation')
      await expect(breadcrumb).toBeVisible()
    })

    test('unit selector switches unit within faction', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_tank`)
      await waitForUnitLoad(page)

      // Click unit selector and pick a different unit
      const unitSelect = page.getByLabel('Unit navigation').getByLabel('Select unit')
      await unitSelect.click()
      await page.locator('[class*="option"]', { hasText: 'Test Bot' }).click()

      // Should navigate to the other unit
      await expect(page).toHaveURL(new RegExp(`/unit/test_bot`))
      await expect(page.getByRole('heading', { name: 'Test Bot' })).toBeVisible()
    })
  })

  test.describe('Cross-links', () => {
    test('unit links navigate to correct pages', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}/unit/test_air_factory`)
      await waitForUnitLoad(page)

      // Click on a linked unit name
      const link = page.locator(`a[href*="/unit/test_fighter"]`).first()
      await link.scrollIntoViewIfNeeded()
      if (await link.isVisible()) {
        await link.click()
        await expect(page).toHaveURL(new RegExp(`/unit/test_fighter`))
      }
    })
  })
})
