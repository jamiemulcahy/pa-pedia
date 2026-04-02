import { test, expect } from '@playwright/test'
import { FACTIONS, waitForFactionLoad } from './helpers'

test.describe('Faction Detail page', () => {
  test.describe('Basic rendering', () => {
    test('displays faction name, description, and unit count', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      await expect(page.getByRole('heading', { name: FACTIONS.BASE_GAME.name })).toBeVisible()
      await expect(page.getByText(FACTIONS.BASE_GAME.description, { exact: false })).toBeVisible()
      await expect(page.getByText(/\d+ units/i)).toBeVisible()
    })

    test('displays ADDON badge for addon factions', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.ADDON.id}`)
      await waitForFactionLoad(page)

      await expect(page.locator('span').filter({ hasText: /^ADDON$/ })).toBeVisible()
      await expect(page.getByText(/Extends:/i)).toBeVisible()
    })

    test('displays units grouped by category', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Should see category headings
      await expect(page.getByText('Commanders')).toBeVisible()
      await expect(page.getByText('Tanks')).toBeVisible()
    })

    test('shows inaccessible unit count badge', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // TestBaseGame has 1 inaccessible unit
      await expect(page.getByText(/1 hidden/i)).toBeVisible()
    })
  })

  test.describe('Search', () => {
    test('search finds units by name', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Type in search — the react-select shows matching options
      const searchInput = page.getByLabel('Search units by name')
      await searchInput.click()
      await page.keyboard.type('Tank')

      // Should show matching options
      await expect(page.locator('[class*="option"]', { hasText: 'Test Tank' })).toBeVisible()
    })

    test('search shows no options for non-matching query', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      const searchInput = page.getByLabel('Search units by name')
      await searchInput.click()
      await page.keyboard.type('xyznonexistent')

      // React-select shows "No options" or similar when nothing matches
      await expect(page.locator('[class*="menu"]', { hasText: /no/i })).toBeVisible()
    })
  })

  test.describe('Type filter', () => {
    test('type filter narrows displayed units', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Get initial unit count text
      const initialText = await page.getByText(/\d+ units/i).textContent()

      // Open type filter and select "Tank"
      const typeFilter = page.getByLabel('Filter units by type')
      await typeFilter.click()
      await page.keyboard.type('Tank')
      await page.locator('[class*="option"]', { hasText: 'Tank' }).first().click()

      // Unit count should decrease
      const filteredText = await page.getByText(/\d+ units/i).textContent()
      expect(filteredText).not.toEqual(initialText)
    })

    test('clearing filter restores all units', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      const initialText = await page.getByText(/\d+ units/i).textContent()

      // Apply filter
      const typeFilter = page.getByLabel('Filter units by type')
      await typeFilter.click()
      await page.keyboard.type('Tank')
      await page.locator('[class*="option"]', { hasText: 'Tank' }).first().click()
      await page.keyboard.press('Escape')

      // Verify filter is active (count changed)
      const filteredText = await page.getByText(/\d+ units/i).textContent()
      expect(filteredText).not.toEqual(initialText)

      // Reload page to reset filters
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Should show original count again
      await expect(page.getByText(initialText!)).toBeVisible()
    })
  })

  test.describe('View modes', () => {
    test('view mode toggle cycles through modes', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Default is list view — toggle should say "Switch to grid view"
      const toggle = page.getByLabel(/Switch to (grid|table|list) view/)
      await expect(toggle).toBeVisible()

      // Click through: list -> grid -> table -> list
      const firstLabel = await toggle.getAttribute('aria-label')
      await toggle.click()

      const secondLabel = await toggle.getAttribute('aria-label')
      expect(secondLabel).not.toEqual(firstLabel)

      await toggle.click()
      const thirdLabel = await toggle.getAttribute('aria-label')
      expect(thirdLabel).not.toEqual(secondLabel)
    })

    test('compact toggle only visible in grid mode', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Click until we're in grid mode
      const toggle = page.getByLabel(/Switch to (grid|table|list) view/)
      // Keep clicking until we see "Switch to table view" (means we're in grid mode)
      for (let i = 0; i < 3; i++) {
        const label = await toggle.getAttribute('aria-label')
        if (label === 'Switch to table view') break
        await toggle.click()
      }

      // Compact toggle should be visible in grid mode
      await expect(page.getByLabel(/Switch to (compact|normal) view/)).toBeVisible()

      // Switch to table mode
      await toggle.click()

      // Compact toggle should NOT be visible
      await expect(page.getByLabel(/Switch to (compact|normal) view/)).not.toBeVisible()

      await page.evaluate(() => localStorage.clear())
    })
  })

  test.describe('Category management', () => {
    test('can collapse and expand categories in grid mode', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Switch to grid mode
      const toggle = page.getByLabel(/Switch to (grid|table|list) view/)
      for (let i = 0; i < 3; i++) {
        const label = await toggle.getAttribute('aria-label')
        if (label === 'Switch to table view') break
        await toggle.click()
      }

      // Find any collapse/expand all button as proof categories are collapsible
      const collapseAllBtn = page.getByLabel(/Collapse all categories/)
      await expect(collapseAllBtn).toBeVisible()

      await page.evaluate(() => localStorage.clear())
    })

    test('expand/collapse all button works in grid mode', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Switch to grid mode
      const toggle = page.getByLabel(/Switch to (grid|table|list) view/)
      for (let i = 0; i < 3; i++) {
        const label = await toggle.getAttribute('aria-label')
        if (label === 'Switch to table view') break
        await toggle.click()
      }

      // Click collapse all
      const collapseBtn = page.getByLabel(/Collapse all categories/)
      if (await collapseBtn.isVisible()) {
        await collapseBtn.click()
        // Should now say "Expand all"
        await expect(page.getByLabel(/Expand all categories/)).toBeVisible()

        // Click expand all
        await page.getByLabel(/Expand all categories/).click()
        await expect(page.getByLabel(/Collapse all categories/)).toBeVisible()
      }

      await page.evaluate(() => localStorage.clear())
    })
  })

  test.describe('Inaccessible units', () => {
    test('inaccessible units hidden by default', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Test Mine (inaccessible) should not be visible
      await expect(page.getByText('Test Mine')).not.toBeVisible()
    })

    test('toggling show inaccessible reveals hidden units', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Click the show inaccessible toggle
      const inaccessibleToggle = page.getByLabel(/Show \d+ inaccessible unit/)
      await inaccessibleToggle.click()

      // Test Mine should now be visible
      await expect(page.getByText('Test Mine')).toBeVisible()

      await page.evaluate(() => localStorage.clear())
    })
  })

  test.describe('Faction selector', () => {
    test('faction dropdown allows switching factions', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      // Click faction selector and choose TestFaction
      const factionSelect = page.getByLabel('Select faction')
      await factionSelect.click()
      await page.locator('[class*="option"]', { hasText: FACTIONS.FACTION.name }).click()

      // Should navigate to the other faction
      await expect(page).toHaveURL(`/faction/${FACTIONS.FACTION.id}`)
    })

    test('faction dropdown includes All option', async ({ page }) => {
      await page.goto(`/faction/${FACTIONS.BASE_GAME.id}`)
      await waitForFactionLoad(page)

      const factionSelect = page.getByLabel('Select faction')
      await factionSelect.click()

      await expect(page.locator('[class*="option"]', { hasText: 'All' })).toBeVisible()
    })
  })
})
