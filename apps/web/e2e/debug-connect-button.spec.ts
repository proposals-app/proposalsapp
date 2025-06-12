import { test, expect } from '@playwright/test';

test('Debug - Check connect button structure', async ({ page }) => {
  console.log('Navigating to Storybook basic story...');
  await page.goto('http://localhost:6006/?story=vote-button--snapshot-basic');
  
  // Wait for page to load
  await page.waitForTimeout(5000);
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'debug-connect-button.png', fullPage: true });
  console.log('Screenshot saved as debug-connect-button.png');
  
  // Get page title
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
  
  // Look for any elements with 'connect' or 'rk-' in attributes
  const connectElements = await page.locator('[class*="connect"], [id*="connect"], [data-testid*="connect"], [class*="rk-"], [data-testid*="rk-"]').all();
  console.log(`Found ${connectElements.length} elements with 'connect' or 'rk-' in attributes`);
  
  for (let i = 0; i < connectElements.length; i++) {
    const element = connectElements[i];
    const tagName = await element.evaluate(el => el.tagName);
    const text = await element.textContent();
    const testId = await element.getAttribute('data-testid');
    const id = await element.getAttribute('id');
    const className = await element.getAttribute('class');
    console.log(`Connect/RK element ${i}: tag="${tagName}", text="${text}", testId="${testId}", id="${id}", class="${className}"`);
  }
  
  // Check if the story iframe is loaded
  const iframe = page.locator('iframe[title="storybook-preview-iframe"]');
  if (await iframe.isVisible()) {
    console.log('Story iframe found, checking inside iframe...');
    const frame = await iframe.contentFrame();
    if (frame) {
      const frameButtons = await frame.locator('button').all();
      console.log(`Found ${frameButtons.length} buttons inside iframe`);
      
      for (let i = 0; i < frameButtons.length; i++) {
        const button = frameButtons[i];
        const text = await button.textContent();
        const testId = await button.getAttribute('data-testid');
        const id = await button.getAttribute('id');
        const className = await button.getAttribute('class');
        console.log(`Iframe Button ${i}: text="${text}", testId="${testId}", id="${id}", class="${className}"`);
      }
      
      // Look for connect elements in iframe
      const iframeConnectElements = await frame.locator('[class*="connect"], [id*="connect"], [data-testid*="connect"], [class*="rk-"], [data-testid*="rk-"]').all();
      console.log(`Found ${iframeConnectElements.length} connect/rk elements inside iframe`);
      
      for (let i = 0; i < iframeConnectElements.length; i++) {
        const element = iframeConnectElements[i];
        const tagName = await element.evaluate(el => el.tagName);
        const text = await element.textContent();
        const testId = await element.getAttribute('data-testid');
        const id = await element.getAttribute('id');
        const className = await element.getAttribute('class');
        console.log(`Iframe Connect/RK element ${i}: tag="${tagName}", text="${text}", testId="${testId}", id="${id}", class="${className}"`);
      }
    }
  } else {
    console.log('No story iframe found');
  }
});