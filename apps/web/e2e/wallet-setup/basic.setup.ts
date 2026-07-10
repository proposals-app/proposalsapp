import { defineWalletSetup } from '@synthetixio/synpress';
import { MetaMask } from '@synthetixio/synpress/playwright';
import type { BrowserContext, Page } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

// Define a test seed phrase and password
const SEED_PHRASE = process.env.TEST_ACCOUNT_SEED_PHRASE!;
const PASSWORD = 'Tester@1234';

async function finishOnboarding(context: BrowserContext, walletPage: Page) {
  const openWalletButton = walletPage.getByRole('button', {
    name: 'Open wallet',
  });
  if (!(await openWalletButton.isVisible({ timeout: 5000 }))) return;

  await openWalletButton.click();
  await walletPage.waitForTimeout(500);

  // In headless Chromium the completion button may not open a new extension
  // tab. The wallet has already been imported, so open its home route in the
  // existing extension page before the profile is cached.
  if (walletPage.url().includes('#onboarding')) {
    const extensionRoot = walletPage.url().split('/home.html')[0];
    await walletPage.goto(`${extensionRoot}/home.html`);
  }

  const homePage = context
    .pages()
    .find(
      (candidate) =>
        candidate.url().includes('/home.html') &&
        !candidate.url().includes('#onboarding')
    );
  if (!homePage) {
    throw new Error('MetaMask did not open the wallet after onboarding');
  }

  for (const candidate of context.pages()) {
    if (
      candidate !== homePage &&
      candidate.url().startsWith('chrome-extension://')
    ) {
      await candidate.close();
    }
  }
  await homePage.bringToFront();
}

// Define the basic wallet setup
export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  // Create a new MetaMask instance
  const metamask = new MetaMask(context, walletPage, PASSWORD);

  // Import the wallet using the seed phrase
  await metamask.importWallet(SEED_PHRASE);

  // MetaMask 13 may leave the imported wallet on its completion screen. A
  // cache captured there reopens locked and cannot receive dapp prompts.
  await finishOnboarding(context, walletPage);
  // The Synpress fixture always unlocks a restored profile. Cache the wallet
  // in that expected state so setup cannot wait indefinitely for a lock form.
  await metamask.lock();
});
