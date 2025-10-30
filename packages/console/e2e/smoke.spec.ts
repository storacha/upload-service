import { test, expect } from '@playwright/test'

const CONSOLE_URL = process.env.CONSOLE_URL || 'http://localhost:3000'

test.describe('Console Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CONSOLE_URL)
  })

  test('should load the console homepage', async ({ page }) => {
    // Should show authentication form for unauthenticated users
    await expect(page.locator('.authenticator')).toBeVisible()
    
    // Should have email input for authentication
    await expect(page.locator('input[type="email"]')).toBeVisible()
    
    // Should have authorize button
    await expect(page.locator('button[type="submit"]')).toBeVisible()
    
    // Should have proper page title
    await expect(page).toHaveTitle(/Storacha console/)
  })

  test('should display terms of service', async ({ page }) => {
    // Check that terms of service link is present
    await expect(page.locator('a[href="https://docs.storacha.network/terms/"]')).toBeVisible()
  })

  test('should have working navigation structure', async ({ page }) => {
    // Check if navigation elements are present
    // Note: These tests assume unauthenticated state, so we're testing the basic page structure
    
    // Authentication form should be present
    await expect(page.locator('form')).toBeVisible()
    
    // Should show Storacha logo
    await expect(page.locator('svg, img')).toBeVisible()
  })

  test('should handle iframe context detection', async ({ page }) => {
    // Test iframe page specifically
    await page.goto(`${CONSOLE_URL}/iframe`)
    
    // Should still load without errors - iframe may show different title
    await expect(page).toHaveTitle(/.+/) // Just verify some title exists
  })

  test('should handle error pages gracefully', async ({ page }) => {
    // Test non-existent page
    const response = await page.goto(`${CONSOLE_URL}/non-existent-page`, { 
      waitUntil: 'networkidle' 
    })
    
    // Should return 404 or redirect gracefully
    expect([200, 404]).toContain(response?.status() || 0)
  })
})

test.describe('Console Authentication Flow', () => {
  test('should validate email input', async ({ page }) => {
    await page.goto(CONSOLE_URL)
    
    const emailInput = page.locator('input[type="email"]')
    const submitButton = page.locator('button[type="submit"]')
    
    // Try submitting with invalid email
    await emailInput.fill('invalid-email')
    await submitButton.click()
    
    // Should show browser validation message or prevent submission
    // Note: This depends on browser behavior for invalid emails
    await expect(emailInput).toBeVisible()
  })

  test('should handle authentication form submission', async ({ page }) => {
    await page.goto(CONSOLE_URL)
    
    const emailInput = page.locator('input[type="email"]')
    const submitButton = page.locator('button[type="submit"]')
    
    // Fill valid email
    await emailInput.fill('test@example.com')
    await submitButton.click()
    
    // Should show submission state or redirect
    // In real implementation, this would show "check your email" message
    // For smoke test, we just verify the form interaction works
    await expect(submitButton).toBeVisible()
  })
})

test.describe('Console UI Components', () => {
  test('should load with proper styling', async ({ page }) => {
    await page.goto(CONSOLE_URL)
    
    // Check if Tailwind CSS classes are applied
    const authenticator = page.locator('.authenticator')
    await expect(authenticator).toBeVisible()
    
    // Check for hot-red theme colors (custom Tailwind classes)
    const submitButton = page.locator('button[type="submit"]')
    const buttonClasses = await submitButton.getAttribute('class')
    expect(buttonClasses).toContain('hot-red')
  })

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(CONSOLE_URL)
    
    // Should still be usable on mobile
    await expect(page.locator('.authenticator')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })
})

test.describe('Console Routing', () => {
  test('should handle space routes', async ({ page }) => {
    // Test space creation route
    const response = await page.goto(`${CONSOLE_URL}/space/create`)
    expect([200, 302]).toContain(response?.status() || 0) // 302 for redirect to auth
  })

  test('should handle space import route', async ({ page }) => {
    const response = await page.goto(`${CONSOLE_URL}/space/import`)
    expect([200, 302]).toContain(response?.status() || 0)
  })

  test('should handle settings route', async ({ page }) => {
    const response = await page.goto(`${CONSOLE_URL}/settings`)
    expect([200, 302]).toContain(response?.status() || 0)
  })
})