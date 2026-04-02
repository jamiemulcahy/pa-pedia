import { test, expect } from '@playwright/test'

test.describe('Upload Modal', () => {
  test('upload modal opens and closes', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Upload local faction').click()
    await expect(page.getByText('Upload Local Faction')).toBeVisible()

    // Close with Cancel
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByText('Upload Local Faction')).not.toBeVisible()
  })

  test('upload modal shows file requirements', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Upload local faction').click()

    await expect(page.getByText('File Requirements')).toBeVisible()
    await expect(page.getByText('.zip files only')).toBeVisible()
  })

  test('upload modal close button works', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Upload local faction').click()
    await expect(page.getByText('Upload Local Faction')).toBeVisible()

    // Close with X button
    await page.locator('[role="dialog"]').getByLabel('Close').click()
    await expect(page.getByText('Upload Local Faction')).not.toBeVisible()
  })

  test('upload modal has CLI download link', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Upload local faction').click()

    await expect(page.getByText('Need faction data?')).toBeVisible()
  })

  test('backdrop click closes upload modal', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Upload local faction').click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Click the backdrop (the dialog overlay itself, not the content)
    await dialog.click({ position: { x: 5, y: 5 } })
    await expect(dialog).not.toBeVisible()
  })
})

test.describe('CLI Download Modal', () => {
  test('CLI download modal opens and shows content', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Download CLI tool').click()

    // Check the modal title
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Download PA-Pedia CLI')).toBeVisible()

    // Should show Quick Start section
    await expect(dialog.getByText('Quick Start')).toBeVisible()
  })

  test('CLI download modal closes with close button', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Download CLI tool').click()
    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Close using either a Close button or the X button
    const closeBtn = dialog.getByRole('button', { name: /close/i }).first()
    await closeBtn.click()
    await expect(dialog).not.toBeVisible()
  })

  test('escape key closes CLI modal', async ({ page }) => {
    await page.goto('/')

    await page.getByLabel('Download CLI tool').click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    await page.waitForTimeout(200)
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })
})
