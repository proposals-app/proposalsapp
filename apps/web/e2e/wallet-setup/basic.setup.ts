import { defineWalletSetup } from '@synthetixio/synpress';
import { MetaMask } from '@synthetixio/synpress/playwright';
import dotenv from 'dotenv';

dotenv.config();

// Define a test seed phrase and password
const SEED_PHRASE = process.env.TEST_ACCOUNT_SEED_PHRASE!;
const PASSWORD = 'Tester@1234';

// Define the basic wallet setup
export default defineWalletSetup(PASSWORD, async (context, walletPage) => {
  // Create a new MetaMask instance
  const metamask = new MetaMask(context, walletPage, PASSWORD);

  // Import the wallet using the seed phrase
  await metamask.importWallet(SEED_PHRASE);
});
