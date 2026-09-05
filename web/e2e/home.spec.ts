import { test, expect } from '@playwright/test'
import { FACTIONS, ALL_FACTION_IDS, factionCard } from './helpers'

test.describe('Home page', () => {
  test('loads and displays faction cards', async ({ page }) => {
    await page.goto('/')

    // All 3 test factions should be visible
    await expect(page.getByText(FACTIONS.BASE_GAME.name).first()).toBeVisible()
    await expect(page.getByText(FACTIONS.FACTION.name).first()).toBeVisible()
    await expect(page.getByText(FACTIONS.ADDON.name).first()).toBeVisible()
  })

  test('shows "All" card linking to /faction', async ({ page }) => {
    await page.goto('/')

    const allCard = page.getByLabel('Browse all factions')
    await expect(allCard).toBeVisible()
    await expect(allCard).toHaveAttribute('href', '/faction')
  })

  test('shows ADDON badge on addon faction', async ({ page }) => {
    await page.goto('/')

    const addonCard = factionCard(page, FACTIONS.ADDON.id)
    await expect(addonCard).toBeVisible()
    // Exact match: hasText is a case-insensitive substring, so a loose 'ADDON'
    // also matches the byline of a faction whose author name contains "addon".
    await expect(addonCard.locator('span').filter({ hasText: /^ADDON$/ })).toBeVisible()
  })

  test('shows community links', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: /GG Leaderboards/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /PA Discord/i })).toBeVisible()
  })

  test('each faction card links to correct route', async ({ page }) => {
    await page.goto('/')

    for (const id of ALL_FACTION_IDS) {
      const card = page.locator(`a[href="/faction/${id}"]`)
      await expect(card).toBeVisible()
    }
  })

  test('shows faction metadata on cards', async ({ page }) => {
    await page.goto('/')

    // Verify author is shown on at least one card
    await expect(page.getByText(FACTIONS.BASE_GAME.author).first()).toBeVisible()
  })

  test('addon faction card shows extends info', async ({ page }) => {
    await page.goto('/')

    // Second Wave-style "Extends:" text
    const addonCard = factionCard(page, FACTIONS.ADDON.id)
    await expect(addonCard.getByText(/Extends:/i)).toBeVisible()
  })

  test('faction card links to the source repo root, deduped', async ({ page }) => {
    await page.goto('/')

    // The fixture lists a client and a server folder on one branch of one repo;
    // both collapse to a single link at the repository root.
    const card = factionCard(page, FACTIONS.FACTION.id)
    const repoLink = card.getByRole('link', { name: 'test-org/test-faction' })
    await expect(repoLink).toHaveCount(1)
    await expect(repoLink).toHaveAttribute('href', 'https://github.com/test-org/test-faction')
    await expect(repoLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('faction card with no GitHub source shows no repo link', async ({ page }) => {
    await page.goto('/')

    const card = factionCard(page, FACTIONS.BASE_GAME.id)
    await expect(card).toBeVisible()
    await expect(card.locator('a[href*="github.com"]')).toHaveCount(0)
  })

  test('header shows upload and download buttons', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByLabel('Upload local faction')).toBeVisible()
    await expect(page.getByLabel('Download CLI tool')).toBeVisible()
  })

  test('clicking download button opens CLI download modal', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Download CLI tool').click()

    // Verify modal appeared
    await expect(page.getByText('Download PA-Pedia CLI')).toBeVisible()

    // Close modal
    await page.keyboard.press('Escape')
    await expect(page.getByText('Download PA-Pedia CLI')).not.toBeVisible()
  })
})
