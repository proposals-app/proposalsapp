import { test, expect } from '@playwright/test';

test('Debug - Check what is on the page', async ({ page }) => {
  console.log('Navigating to Storybook...');
  await page.goto('http://localhost:6006/?story=vote-button--snapshot--basic');
  
  // Wait a bit for page to load
  await page.waitForTimeout(5000);
  
  // Take a screenshot
  await page.screenshot({ path: 'debug-page.png', fullPage: true });
  console.log('Screenshot saved as debug-page.png');
  
  // Get page content
  const pageContent = await page.content();
  console.log('Page title:', await page.title());
  
  // Look for any buttons
  const buttons = await page.locator('button').all();
  console.log(`Found ${buttons.length} buttons on the page`);
  
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    const text = await button.textContent();
    const testId = await button.getAttribute('data-testid');
    const id = await button.getAttribute('id');
    const className = await button.getAttribute('class');
    console.log(`Button ${i}: text="${text}", testId="${testId}", id="${id}", class="${className}"`);
  }
  
  // Look for any elements with 'connect' in class or id
  const connectElements = await page.locator('[class*="connect"], [id*="connect"], [data-testid*="connect"]').all();
  console.log(`Found ${connectElements.length} elements with 'connect' in attributes`);
  
  for (let i = 0; i < connectElements.length; i++) {
    const element = connectElements[i];
    const tagName = await element.evaluate(el => el.tagName);
    const text = await element.textContent();
    const testId = await element.getAttribute('data-testid');
    const id = await element.getAttribute('id');
    const className = await element.getAttribute('class');
    console.log(`Connect element ${i}: tag="${tagName}", text="${text}", testId="${testId}", id="${id}", class="${className}"`);
  }
});