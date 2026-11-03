import { expect, test } from '@playwright/test'

test('shows the Phase 1 mobile shell', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('shopreel.mock-auth', 'true')
    localStorage.setItem('shopreel.mock-profile', JSON.stringify({ id: 'test', handle: 'tester', display_name: 'Tester' }))
  })
  await page.goto('/')
  await expect(page.getByText('ShopReel')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Feed' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Wishlist' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Bag' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Me' })).toBeVisible()
})

test('signs in with a mock account, completes onboarding, and reaches the feed', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shopreel.mock-auth', 'true'))
  await page.goto('/login')
  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel('Unique handle').fill('demo_shopper')
  await page.getByLabel(/18 or older/).check()
  await page.getByLabel(/Terms/).check()
  await page.getByRole('button', { name: 'Finish setup' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('ShopReel')).toBeVisible()
})
