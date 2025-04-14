import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { ethers } from 'ethers';
import snapshot from '@snapshot-labs/snapshot.js';
import basicSetup from './wallet-setup/basic.setup'; // Used by synpress fixture, not directly for key
// Import fetch for API calls
import fetch from 'cross-fetch'; // Use cross-fetch for Node.js/browser compatibility

const HUB_URL = 'https://testnet.hub.snapshot.org'; // Using Snapshot testnet
const SPACE_ID = 'proposalsapp-area51.eth';
const RPC_URL = 'https://arbitrum.drpc.org';

const TEST_TIMEOUT = 300 * 1000; // Increased timeout for potential API delays
// const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)); // Keep if needed

interface ProposalReceipt {
  id: string;
  ipfs: string;
  relayer?: {
    address: string;
    receipt: string;
  };
}

// Retrieve the seed phrase from environment variables
const seedPhrase = process.env.TEST_ACCOUNT_SEED_PHRASE;
if (!seedPhrase) {
  throw new Error(
    'TEST_ACCOUNT_SEED_PHRASE environment variable is not set. This is required to derive the test wallet.'
  );
}

const test = testWithSynpress(metaMaskFixtures(basicSetup));

const { expect } = test;

// --- Enforce Sequential Execution ---
test.describe.serial('Offchain Voting E2E Tests', () => {
  test('should create a proposal via API, vote via UI, and verify vote via API', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT); // Apply increased timeout

    // --- Setup Signer for Snapshot API Call ---

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    // Derive the wallet directly from the seed phrase
    const wallet = ethers.Wallet.fromMnemonic(seedPhrase).connect(provider);
    const signerAddress = await wallet.getAddress();
    const currentBlock = await provider.getBlockNumber();

    console.log(`Using signer address: ${signerAddress}`);
    console.log(
      `Using network: ${await provider.getNetwork().then((n) => n.name)}`
    );
    console.log(`Latest block number: ${currentBlock}`);

    // --- Create Proposal via Snapshot.js Client ---
    const client = new snapshot.Client712(HUB_URL);
    // Ensure proposal is active for a short duration for voting
    const startAt = Math.floor(new Date().getTime() / 1000) - 30; // Start slightly in the past
    const endAt = startAt + 60 * 5; // End 5 minutes from start

    const proposalTitle = `E2E Test Proposal (Single Choice) - ${new Date().toISOString()}`;
    let proposalReceipt: ProposalReceipt;
    let proposalId = '';
    try {
      console.log('Attempting to create proposal...');
      // Use type assertion to inform TypeScript about the expected structure
      proposalReceipt = (await client.proposal(wallet, signerAddress, {
        space: SPACE_ID,
        type: 'approval',
        title: proposalTitle,
        body: 'This is an automated test proposal created via snapshot.js for single-choice voting.',
        choices: ['Approve Choice 1', 'Approve Choice 2', 'Approve Choice 3'],
        start: startAt,
        end: endAt,
        snapshot: currentBlock,
        plugins: JSON.stringify({}),
        app: 'proposalsapp-e2e-test',
        discussion: '',
      })) as ProposalReceipt; // Assert the expected type

      proposalId = proposalReceipt.id; // Now safe to access .id
      console.log('Proposal creation successful:', proposalReceipt);
      console.log(`Proposal ID: ${proposalId}`);
      // Add a small delay to allow Snapshot indexer to potentially catch up slightly
      // await page.waitForTimeout(3000); // Optional delay
    } catch (error) {
      console.error('Error creating proposal:', JSON.stringify(error));
      throw new Error(`Failed to create proposal: ${error}`); // Fail test if proposal creation fails
    }

    // --- Interact with the Web Application ---
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );

    // Navigate to the storybook page displaying the latest proposal component
    await page.goto(
      'http://localhost:61000/?story=vote-button--latest-proposal'
    );

    // --- Connect Wallet ---
    // Wait for the initial "Connect Wallet" text to confirm page loaded before connection
    await expect(
      page.getByRole('button', { name: 'Connect Wallet' })
    ).toBeVisible({ timeout: 20000 }); // Increased timeout for potentially slow loads

    await page.getByTestId('rk-connect-button').click();
    await page.getByTestId('rk-wallet-option-io.metamask').click();

    await metamask.connectToDapp(); // Connect wallet in Metamask popup
    // Approve network add/switch if needed (might not always appear)

    try {
      await metamask.approveNewNetwork();
    } catch (e) {
      console.log('Approve new network step skipped or failed, continuing...');
    }
    try {
      await metamask.approveSwitchNetwork();
    } catch (e) {
      console.log(
        'Approve switch network step skipped or failed, continuing...'
      );
    }

    // --- Vote on the Proposal via UI ---
    console.log('Attempting to vote via UI...');
    const voteButton = page.getByRole('button', { name: 'Cast Your Vote' });
    // Wait longer for the button to appear after connection and potential proposal loading
    await expect(voteButton).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    console.log(`Verifying modal title matches: "${proposalTitle}"`);
    // Wait for the dialog to open and check its title
    await expect(
      page.getByRole('heading', { name: proposalTitle })
    ).toBeVisible({
      timeout: 10000,
    });

    // Interact with the Approval Vote Modal
    // Target the first checkbox (choice index 0 -> value 1) using its accessible name
    const firstChoiceCheckbox = page.getByRole('checkbox', {
      name: 'Approve Choice 1',
    });
    await expect(firstChoiceCheckbox).toBeVisible({ timeout: 10000 }); // Wait for modal content
    await firstChoiceCheckbox.check(); // Select the first choice

    const submitVoteButton = page.getByRole('button', { name: 'Submit Vote' });
    await expect(submitVoteButton).toBeEnabled();
    await submitVoteButton.click();

    await page.waitForTimeout(1000);
    // --- Handle Metamask Signature ---
    console.log('Confirming vote signature in Metamask...');

    try {
      const confirmationButton = metamaskPage.getByRole('button', {
        name: 'Got it',
      });
      await confirmationButton.click();
    } catch (e) {
      console.log(
        'Approve switch network step skipped or failed, continuing...'
      );
    }

    await metamask.confirmSignature();

    console.log('Vote submitted via UI, waiting for API verification...');

    await page.waitForTimeout(15000); // Wait 15 seconds

    // --- Verify Vote via Snapshot API ---
    console.log(
      `Verifying vote for proposal: ${proposalId} by voter: ${signerAddress}`
    );

    const graphqlQuery = {
      operationName: 'GetVotes',
      query: `query GetVotes($proposalId: String!, $voterAddress: String!) {
                votes(
                  first: 1,
                  where: {
                    proposal: $proposalId,
                    voter: $voterAddress
                  },
                  orderBy: "created",
                  orderDirection: desc
                ) {
                  id
                  voter
                  choice
                  created
                  reason
                  app
                }
              }`,
      variables: {
        proposalId: proposalId,
        voterAddress: signerAddress,
      },
    };

    let voteVerified = false;
    const maxAttempts = 3;
    let attempt = 0;

    while (!voteVerified && attempt < maxAttempts) {
      attempt++;
      console.log(
        `[Attempt ${attempt}/${maxAttempts}] Querying Snapshot API for vote...`
      );
      try {
        const response = await fetch(`${HUB_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(graphqlQuery),
        });

        if (!response.ok) {
          console.error(
            `Snapshot API query failed with status ${response.status}: ${await response.text()}`
          );
          if (attempt < maxAttempts) {
            console.log(`Retrying after delay...`);
            await page.waitForTimeout(10000); // Wait longer before retrying
            continue;
          } else {
            throw new Error(
              `Snapshot API query failed after ${maxAttempts} attempts.`
            );
          }
        }

        const jsonResponse = await response.json();
        console.log(
          'Snapshot API vote query response:',
          JSON.stringify(jsonResponse, null, 2)
        );

        // Assertions
        expect(jsonResponse.data).toBeDefined();
        expect(jsonResponse.data.votes).toBeDefined();
        expect(jsonResponse.data.votes.length).toBeGreaterThan(0); // Vote should exist

        // Find the specific vote (usually the first one)
        const vote = jsonResponse.data.votes[0];
        expect(vote).toBeDefined();
        expect(vote.voter.toLowerCase()).toBe(signerAddress.toLowerCase());

        // Verify the choice: For 'approval', snapshot.js sends an array [1].
        // The API might return it as an array [1] or an object {"1": 1}. Check for both.
        // Since we selected the first choice (index 0), the expected value is 1.
        const expectedChoice = [1]; // snapshot.js sends 1-based index in an array for approval
        expect(vote.choice).toEqual(expectedChoice);

        // Optionally, verify reason includes attribution if added
        // expect(vote.reason).toContain('voted via proposals.app');
        expect(vote.app).toBe('proposalsapp'); // Check app name used in modal

        console.log(
          `[Attempt ${attempt}] Vote successfully verified via Snapshot API.`
        );
        voteVerified = true; // Exit loop
      } catch (error) {
        console.error(
          `Error during vote verification (Attempt ${attempt}):`,
          error
        );
        if (attempt >= maxAttempts) {
          throw new Error(
            `Failed to verify vote after ${maxAttempts} attempts: ${error}`
          );
        }
        console.log(`Retrying verification after delay...`);
        await page.waitForTimeout(10000); // Wait before retrying verification
      }
    }

    expect(voteVerified).toBe(true); // Ensure verification succeeded within attempts
  });

  test('should create an approval proposal, vote for multiple choices via UI, and verify vote via API', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT); // Apply increased timeout

    // --- Setup Signer for Snapshot API Call ---

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    // Derive the wallet directly from the seed phrase
    const wallet = ethers.Wallet.fromMnemonic(seedPhrase).connect(provider);
    const signerAddress = await wallet.getAddress();
    const currentBlock = await provider.getBlockNumber();

    console.log(`[Multi-Choice] Using signer address: ${signerAddress}`);
    console.log(
      `[Multi-Choice] Using network: ${await provider.getNetwork().then((n) => n.name)}`
    );
    console.log(`[Multi-Choice] Latest block number: ${currentBlock}`);

    // --- Create Proposal via Snapshot.js Client ---
    const client = new snapshot.Client712(HUB_URL);
    // Ensure proposal is active for a short duration for voting
    const startAt = Math.floor(new Date().getTime() / 1000) - 30; // Start slightly in the past
    const endAt = startAt + 60 * 5; // End 5 minutes from start

    const proposalTitle = `E2E Test Proposal (Multi Choice) - ${new Date().toISOString()}`;
    let proposalReceipt: ProposalReceipt;
    let proposalId = '';
    try {
      console.log('[Multi-Choice] Attempting to create proposal...');
      // Use type assertion to inform TypeScript about the expected structure
      proposalReceipt = (await client.proposal(wallet, signerAddress, {
        space: SPACE_ID,
        type: 'approval', // Approval voting allows multiple choices
        title: proposalTitle,
        body: 'This is an automated test proposal created via snapshot.js for multi-choice voting.',
        choices: ['Multi Choice 1', 'Multi Choice 2', 'Multi Choice 3'],
        start: startAt,
        end: endAt,
        snapshot: currentBlock,
        plugins: JSON.stringify({}),
        app: 'proposalsapp-e2e-test',
        discussion: '',
      })) as ProposalReceipt; // Assert the expected type

      proposalId = proposalReceipt.id; // Now safe to access .id
      console.log(
        '[Multi-Choice] Proposal creation successful:',
        proposalReceipt
      );
      console.log(`[Multi-Choice] Proposal ID: ${proposalId}`);
    } catch (error) {
      console.error(
        '[Multi-Choice] Error creating proposal:',
        JSON.stringify(error)
      );
      throw new Error(`[Multi-Choice] Failed to create proposal: ${error}`); // Fail test if proposal creation fails
    }

    // --- Interact with the Web Application ---
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );

    // Navigate to the storybook page displaying the latest proposal component
    await page.goto(
      'http://localhost:61000/?story=vote-button--latest-proposal'
    );

    // --- Connect Wallet ---
    await expect(
      page.getByRole('button', { name: 'Connect Wallet' })
    ).toBeVisible({ timeout: 20000 });

    await page.getByTestId('rk-connect-button').click();
    await page.getByTestId('rk-wallet-option-io.metamask').click();

    await metamask.connectToDapp();

    try {
      await metamask.approveNewNetwork();
    } catch (e) {
      console.log(
        '[Multi-Choice] Approve new network step skipped or failed, continuing...'
      );
    }
    try {
      await metamask.approveSwitchNetwork();
    } catch (e) {
      console.log(
        '[Multi-Choice] Approve switch network step skipped or failed, continuing...'
      );
    }

    // --- Vote on the Proposal via UI ---
    console.log('[Multi-Choice] Attempting to vote via UI...');
    const voteButton = page.getByRole('button', { name: 'Cast Your Vote' });
    await expect(voteButton).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    console.log(
      `[Multi-Choice] Verifying modal title matches: "${proposalTitle}"`
    );
    await expect(
      page.getByRole('heading', { name: proposalTitle })
    ).toBeVisible({
      timeout: 10000,
    });

    // Interact with the Approval Vote Modal - SELECT MULTIPLE CHOICES
    const firstChoiceCheckbox = page.getByRole('checkbox', {
      name: 'Multi Choice 1',
    });
    const thirdChoiceCheckbox = page.getByRole('checkbox', {
      name: 'Multi Choice 3',
    });
    await expect(firstChoiceCheckbox).toBeVisible({ timeout: 10000 });
    await expect(thirdChoiceCheckbox).toBeVisible({ timeout: 10000 });

    await firstChoiceCheckbox.check(); // Select the first choice
    await thirdChoiceCheckbox.check(); // Select the third choice

    const submitVoteButton = page.getByRole('button', { name: 'Submit Vote' });
    await expect(submitVoteButton).toBeEnabled();
    await submitVoteButton.click();

    await page.waitForTimeout(1000);
    // --- Handle Metamask Signature ---
    console.log('[Multi-Choice] Confirming vote signature in Metamask...');

    await metamask.confirmSignature();

    console.log(
      '[Multi-Choice] Vote submitted via UI, waiting for API verification...'
    );

    await page.waitForTimeout(15000); // Wait 15 seconds

    // --- Verify Vote via Snapshot API ---
    console.log(
      `[Multi-Choice] Verifying vote for proposal: ${proposalId} by voter: ${signerAddress}`
    );

    const graphqlQuery = {
      operationName: 'GetVotes',
      query: `query GetVotes($proposalId: String!, $voterAddress: String!) {
                votes(
                  first: 1,
                  where: {
                    proposal: $proposalId,
                    voter: $voterAddress
                  },
                  orderBy: "created",
                  orderDirection: desc
                ) {
                  id
                  voter
                  choice
                  created
                  reason
                  app
                }
              }`,
      variables: {
        proposalId: proposalId,
        voterAddress: signerAddress,
      },
    };

    let voteVerified = false;
    const maxAttempts = 3;
    let attempt = 0;

    while (!voteVerified && attempt < maxAttempts) {
      attempt++;
      console.log(
        `[Multi-Choice] [Attempt ${attempt}/${maxAttempts}] Querying Snapshot API for vote...`
      );
      try {
        const response = await fetch(`${HUB_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(graphqlQuery),
        });

        if (!response.ok) {
          console.error(
            `[Multi-Choice] Snapshot API query failed with status ${response.status}: ${await response.text()}`
          );
          if (attempt < maxAttempts) {
            console.log(`[Multi-Choice] Retrying after delay...`);
            await page.waitForTimeout(10000); // Wait longer before retrying
            continue;
          } else {
            throw new Error(
              `[Multi-Choice] Snapshot API query failed after ${maxAttempts} attempts.`
            );
          }
        }

        const jsonResponse = await response.json();
        console.log(
          '[Multi-Choice] Snapshot API vote query response:',
          JSON.stringify(jsonResponse, null, 2)
        );

        // Assertions
        expect(jsonResponse.data).toBeDefined();
        expect(jsonResponse.data.votes).toBeDefined();
        expect(jsonResponse.data.votes.length).toBeGreaterThan(0); // Vote should exist

        // Find the specific vote (usually the first one)
        const vote = jsonResponse.data.votes[0];
        expect(vote).toBeDefined();
        expect(vote.voter.toLowerCase()).toBe(signerAddress.toLowerCase());

        // Verify the choice: For 'approval', snapshot.js sends an array of 1-based indices.
        // We selected the first (index 0 -> value 1) and third (index 2 -> value 3) choices.
        const expectedChoice = [1, 3];
        expect(vote.choice).toEqual(expectedChoice); // Should be an array containing the chosen indices

        // Optionally, verify reason includes attribution if added
        // expect(vote.reason).toContain('voted via proposals.app');
        expect(vote.app).toBe('proposalsapp'); // Check app name used in modal

        console.log(
          `[Multi-Choice] [Attempt ${attempt}] Vote successfully verified via Snapshot API.`
        );
        voteVerified = true; // Exit loop
      } catch (error) {
        console.error(
          `[Multi-Choice] Error during vote verification (Attempt ${attempt}):`,
          error
        );
        if (attempt >= maxAttempts) {
          throw new Error(
            `[Multi-Choice] Failed to verify vote after ${maxAttempts} attempts: ${error}`
          );
        }
        console.log(`[Multi-Choice] Retrying verification after delay...`);
        await page.waitForTimeout(10000); // Wait before retrying verification
      }
    }

    expect(voteVerified).toBe(true); // Ensure verification succeeded within attempts
  });
}); // End of test.describe.serial
