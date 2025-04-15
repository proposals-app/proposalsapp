import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { ethers } from 'ethers';
import snapshot from '@snapshot-labs/snapshot.js';
import basicSetup from './wallet-setup/basic.setup';
import fetch from 'cross-fetch';

const HUB_URL = 'https://testnet.hub.snapshot.org';
const SPACE_ID = 'proposalsapp-area51.eth';
const RPC_URL = 'https://arbitrum.drpc.org';
const SNAPSHOT_APP_NAME = 'proposalsapp';
const ATTRIBUTION_TEXT = 'voted via proposals.app'; // Match component constant

const TEST_TIMEOUT = 300 * 1000; // Increased timeout for potential API delays + UI interactions
const API_VERIFICATION_DELAY = 15 * 1000; // Wait 15 seconds before first API check
const API_RETRY_DELAY = 10 * 1000; // Wait 10 seconds between API check retries
const API_MAX_ATTEMPTS = 5; // Increased attempts for API verification

interface ProposalReceipt {
  id: string;
  ipfs: string;
  relayer?: {
    address: string;
    receipt: string;
  };
}

interface SnapshotVote {
  id: string;
  ipfs: string;
  voter: string;
  choice: any; // Can be number, array, object depending on type
  created: number;
  reason: string;
  app: string;
}

interface SnapshotProposal {
  id: string;
  type: string;
  title: string;
  created: number;
  end: number; // Added end timestamp
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

// --- Helper Functions ---

async function connectWallet(
  page: any,
  metamask: MetaMask,
  metamaskPage: any, // Accept metamaskPage as an argument
  testLogPrefix: string = ''
) {
  console.log(`${testLogPrefix} Connecting wallet...`);
  // Wait for the initial "Connect Wallet" text to confirm page loaded before connection
  await expect(
    page.getByRole('button', { name: 'Connect Wallet' })
  ).toBeVisible({ timeout: 20000 }); // Increased timeout for potentially slow loads

  await page.getByTestId('rk-connect-button').click();
  await page.getByTestId('rk-wallet-option-io.metamask').click();

  await metamask.connectToDapp(); // Connect wallet in Metamask popup

  // Handle network add/switch prompts gracefully
  try {
    // Sometimes a "Got it" button appears before signing - handle it
    const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' }); // Use the passed metamaskPage
    if (await gotItButton.isVisible({ timeout: 3000 })) {
      console.log(`${testLogPrefix} Clicking 'Got it' button in Metamask...`);
      await gotItButton.click();
    }
  } catch (e) {
    console.log(
      `${testLogPrefix} 'Got it' button not found or clickable, continuing...`
    );
  }

  try {
    await metamask.approveNewNetwork();
  } catch (e) {
    console.log(
      `${testLogPrefix} Approve new network step skipped or failed, continuing...`
    );
  }
  try {
    await metamask.approveSwitchNetwork();
  } catch (e) {
    console.log(
      `${testLogPrefix} Approve switch network step skipped or failed, continuing...`
    );
  }
  console.log(`${testLogPrefix} Wallet connected.`);
}

async function createSnapshotProposal(
  voteType:
    | 'basic'
    | 'single-choice'
    | 'approval'
    | 'quadratic'
    | 'ranked-choice'
    | 'weighted',
  titlePrefix: string,
  bodyText: string,
  choices: string[],
  testLogPrefix: string = '' // Added for consistency
): Promise<{ id: string; signerAddress: string; wallet: ethers.Wallet }> {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  // Use non-null assertion '!' as the initial check guarantees seedPhrase is defined here
  const wallet = ethers.Wallet.fromMnemonic(seedPhrase!).connect(provider);
  const signerAddress = await wallet.getAddress();
  const currentBlock = await provider.getBlockNumber();

  console.log(`${testLogPrefix} Using signer address: ${signerAddress}`);
  console.log(
    `${testLogPrefix} Using network: ${await provider.getNetwork().then((n) => n.name)}`
  );
  console.log(`${testLogPrefix} Latest block number: ${currentBlock}`);

  const client = new snapshot.Client712(HUB_URL);
  const startAt = Math.floor(new Date().getTime() / 1000) - 60; // Start 1 min ago
  const endAt = startAt + 60 * 60 * 24 * 30; // End 30 days from start

  const proposalTitle = `${titlePrefix} - ${new Date().toISOString()}`;
  let proposalReceipt: ProposalReceipt;
  let proposalId = '';

  try {
    console.log(
      `${testLogPrefix} Attempting to create proposal: "${proposalTitle}"...`
    );
    proposalReceipt = (await client.proposal(wallet, signerAddress, {
      space: SPACE_ID,
      type: voteType,
      title: proposalTitle,
      body: bodyText,
      choices: choices,
      start: startAt,
      end: endAt,
      snapshot: currentBlock,
      plugins: JSON.stringify({}),
      app: 'proposalsapp-e2e-test', // App used for creation
      discussion: '',
    })) as ProposalReceipt;

    proposalId = proposalReceipt.id;
    console.log(
      `${testLogPrefix} Proposal creation successful:`,
      proposalReceipt
    );
    console.log(`${testLogPrefix} Proposal ID: ${proposalId}`);
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Small delay for indexer
  } catch (error) {
    console.error(
      `${testLogPrefix} Error creating proposal:`,
      JSON.stringify(error)
    );
    throw new Error(`[${voteType}] Failed to create proposal: ${error}`);
  }

  return { id: proposalId, signerAddress, wallet };
}

async function fetchLatestActiveProposalId(
  voteType:
    | 'basic'
    | 'single-choice'
    | 'approval'
    | 'quadratic'
    | 'ranked-choice'
    | 'weighted',
  titlePrefix: string,
  testLogPrefix: string = ''
): Promise<string | null> {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  console.log(
    `${testLogPrefix} Fetching latest *active* proposal ID for type: ${voteType} (Ending after ${currentTimestamp})...`
  );

  const graphqlQuery = {
    operationName: 'GetActiveProposals',
    query: `
      query GetActiveProposals($spaceId: String!, $type: String!, $titlePrefix: String!, $currentTimestamp: Int!) {
        proposals(
          first: 1
          where: {
            space: $spaceId,
            type: $type,
            title_contains: $titlePrefix,
            end_gt: $currentTimestamp # Filter for proposals that haven't ended yet
          }
          orderBy: "created"
          orderDirection: desc
        ) {
          id
          type
          title
          created
          end # Include end timestamp for verification
        }
      }
    `,
    variables: {
      spaceId: SPACE_ID,
      type: voteType,
      titlePrefix: titlePrefix,
      currentTimestamp: currentTimestamp,
    },
  };

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
        `${testLogPrefix} Snapshot API query failed with status ${response.status}: ${await response.text()}`
      );
      return null;
    }

    const jsonResponse = await response.json();
    if (jsonResponse.errors) {
      console.error(
        `${testLogPrefix} Snapshot API returned GraphQL errors: ${JSON.stringify(jsonResponse.errors)}`
      );
      return null;
    }

    if (
      !jsonResponse.data ||
      !jsonResponse.data.proposals ||
      jsonResponse.data.proposals.length === 0
    ) {
      console.log(
        `${testLogPrefix} No *active* proposals found for type: ${voteType} and title prefix: ${titlePrefix}`
      );
      return null;
    }

    const latestProposal = jsonResponse.data.proposals[0] as SnapshotProposal;
    console.log(
      `${testLogPrefix} Latest *active* proposal ID found: ${latestProposal.id} (Title: "${latestProposal.title}", Ends: ${latestProposal.end})`
    );
    return latestProposal.id;
  } catch (error: any) {
    console.error(
      `${testLogPrefix} Error fetching latest active proposal ID: ${error}`
    );
    return null;
  }
}

async function verifyVoteViaApi(
  proposalId: string,
  voterAddress: string,
  expectedChoice: any,
  expectedReasonContains: string, // Add expectedReasonContains parameter
  testLogPrefix: string = ''
): Promise<void> {
  console.log(
    `${testLogPrefix} Verifying vote for proposal: ${proposalId} by voter: ${voterAddress}`
  );
  console.log(
    `${testLogPrefix} Expecting reason to contain: "${expectedReasonContains}"`
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
                ipfs
                voter
                choice
                created
                reason
                app
              }
            }`,
    variables: {
      proposalId: proposalId,
      voterAddress: voterAddress,
    },
  };

  let voteVerified = false;
  let attempt = 0;
  let lastError: any = null;
  let foundVote: SnapshotVote | null = null;

  while (!voteVerified && attempt < API_MAX_ATTEMPTS) {
    attempt++;
    console.log(
      `${testLogPrefix} [Attempt ${attempt}/${API_MAX_ATTEMPTS}] Querying Snapshot API for vote...`
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
        lastError = `Snapshot API query failed with status ${response.status}: ${await response.text()}`;
        console.error(`${testLogPrefix} ${lastError}`);
      } else {
        const jsonResponse = await response.json();
        console.log(
          `${testLogPrefix} Snapshot API vote query response (Attempt ${attempt}):`,
          JSON.stringify(jsonResponse, null, 2)
        );

        if (jsonResponse.errors) {
          lastError = `Snapshot API returned GraphQL errors: ${JSON.stringify(jsonResponse.errors)}`;
          console.error(`${testLogPrefix} ${lastError}`);
        } else if (
          !jsonResponse.data ||
          !jsonResponse.data.votes ||
          jsonResponse.data.votes.length === 0
        ) {
          lastError = 'Vote not found in Snapshot API response data yet.';
          console.warn(`${testLogPrefix} ${lastError}`);
        } else {
          // Vote found, proceed with verification
          foundVote = jsonResponse.data.votes[0] as SnapshotVote;

          expect(foundVote).toBeDefined();
          expect(foundVote.id).toBeDefined();
          expect(typeof foundVote.id).toBe('string');
          expect(foundVote.id.length).toBeGreaterThan(10); // Basic check for valid ID format
          expect(foundVote.voter.toLowerCase()).toBe(
            voterAddress.toLowerCase()
          );
          expect(foundVote.app).toBe(SNAPSHOT_APP_NAME); // Verify app name used in modal
          expect(foundVote.choice).toEqual(expectedChoice);
          // *** ADD REASON VERIFICATION ***
          expect(
            foundVote.reason,
            `Reason "${foundVote.reason}" should contain "${expectedReasonContains}"`
          ).toContain(expectedReasonContains);

          console.log(
            `${testLogPrefix} [Attempt ${attempt}] Vote successfully verified via Snapshot API (ID: ${foundVote.id}).`
          );
          voteVerified = true; // Exit loop
        }
      }
    } catch (error: any) {
      lastError = `Error during vote verification API call (Attempt ${attempt}): ${error}`;
      console.error(`${testLogPrefix} ${lastError}`);
    }

    if (!voteVerified && attempt < API_MAX_ATTEMPTS) {
      console.log(
        `${testLogPrefix} Retrying verification after ${API_RETRY_DELAY / 1000}s delay...`
      );
      await new Promise((resolve) => setTimeout(resolve, API_RETRY_DELAY));
    }
  } // End while loop

  if (!voteVerified) {
    console.error(
      `${testLogPrefix} Final verification attempt failed. Last error:`,
      lastError
    );
    console.error(
      `${testLogPrefix} Last successful vote data found (if any):`,
      foundVote
    );
  }

  expect(
    voteVerified,
    `Vote verification failed after ${API_MAX_ATTEMPTS} attempts. See logs for details. Last error: ${lastError}. Expected reason to contain: "${expectedReasonContains}"`
  ).toBe(true);
}

// --- Enforce Sequential Execution ---
test.describe.serial('Offchain Voting E2E Tests', () => {
  // --- BASIC ---
  test('[Basic] should use active or create proposal, vote via UI, verify via API', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Basic]';
    const voteType = 'basic';
    const choices = ['Yes', 'No', 'Abstain'];
    const proposalTitlePrefix = 'E2E Test Proposal (Basic)';
    let proposalId: string | null = null;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`; // Assuming attribution checkbox is checked by default

    // --- Fetch Active or Create New Proposal ID ---
    proposalId = await fetchLatestActiveProposalId(
      voteType,
      proposalTitlePrefix,
      testLogPrefix
    );

    if (!proposalId) {
      console.log(
        `${testLogPrefix} No active proposal found. Creating a new one...`
      );
      const proposalData = await createSnapshotProposal(
        voteType,
        proposalTitlePrefix,
        'Automated test proposal for basic voting.',
        choices,
        testLogPrefix
      );
      proposalId = proposalData.id;
    } else {
      console.log(
        `${testLogPrefix} Using existing active proposal: ${proposalId}`
      );
    }

    expect(
      proposalId,
      `${testLogPrefix} proposalId should be defined after fetch or create`
    ).toBeDefined();
    // Ensure proposalId is treated as non-null from here on
    proposalId = proposalId!;

    // --- Interact with the Web Application ---
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:61000/?story=vote-button--basic-proposal`
    );
    // Pass metamaskPage to connectWallet
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    // --- Vote on the Proposal via UI ---
    console.log(`${testLogPrefix} Attempting to vote via UI...`);
    const voteButton = page.getByRole('button', { name: 'Cast Your Vote' });
    await expect(voteButton).toBeVisible({ timeout: 30000 }); // Wait for button/proposal load
    await voteButton.click();

    const proposalTitle = await page
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent(); // DialogTitle selector
    expect(proposalTitle).toContain(proposalTitlePrefix); // Check it's the right proposal modal
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    // Interact with the Basic/Single-Choice Vote Modal
    const choiceToSelect = choices[1]; // Select the second choice (index 1)
    const expectedChoiceValue = 2; // 1-based index
    const choiceRadioButton = page.getByRole('radio', { name: choiceToSelect });
    await expect(choiceRadioButton).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    // Fill reason textarea
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await page.locator('textarea#reason').fill(uniqueReasonNonce);
    // Ensure attribution checkbox is checked (it should be by default)
    // await expect(page.locator('input#attribution')).toBeChecked();

    const submitVoteButton = page.getByRole('button', { name: 'Submit Vote' });
    await expect(submitVoteButton).toBeEnabled();
    await submitVoteButton.click();

    await page.waitForTimeout(1000);

    try {
      // Sometimes a "Got it" button appears before signing - handle it
      const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' }); // Use the passed metamaskPage
      if (await gotItButton.isVisible({ timeout: 3000 })) {
        console.log(`${testLogPrefix} Clicking 'Got it' button in Metamask...`);
        await gotItButton.click();
      }
    } catch (e) {
      console.log(
        `${testLogPrefix} 'Got it' button not found or clickable, continuing...`
      );
    }

    // --- Handle Metamask Signature ---
    console.log(`${testLogPrefix} Confirming vote signature in Metamask...`);
    await metamask.confirmSignature();

    console.log(
      `${testLogPrefix} Vote submitted via UI, waiting for API verification...`
    );
    await page.waitForTimeout(API_VERIFICATION_DELAY);

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId, // proposalId is now guaranteed non-null
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString, // Pass expected reason
      testLogPrefix
    );
  });

  // --- SINGLE CHOICE ---
  test('[Single-Choice] should use active or create proposal, vote via UI, verify via API', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Single-Choice]';
    const voteType = 'single-choice';
    const choices = ['SC Choice 1', 'SC Choice 2', 'SC Choice 3'];
    const proposalTitlePrefix = 'E2E Test Proposal (Single Choice)';
    let proposalId: string | null = null;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`; // Assuming attribution checkbox is checked by default

    // --- Fetch Active or Create New Proposal ID ---
    proposalId = await fetchLatestActiveProposalId(
      voteType,
      proposalTitlePrefix,
      testLogPrefix
    );

    if (!proposalId) {
      console.log(
        `${testLogPrefix} No active proposal found. Creating a new one...`
      );
      const proposalData = await createSnapshotProposal(
        voteType,
        proposalTitlePrefix,
        'Automated test proposal for single-choice voting.',
        choices,
        testLogPrefix
      );
      proposalId = proposalData.id;
    } else {
      console.log(
        `${testLogPrefix} Using existing active proposal: ${proposalId}`
      );
    }

    expect(
      proposalId,
      `${testLogPrefix} proposalId should be defined after fetch or create`
    ).toBeDefined();
    // Ensure proposalId is treated as non-null from here on
    proposalId = proposalId!;

    // --- Interact with the Web Application ---
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:61000/?story=vote-button--single-choice-proposal`
    );
    // Pass metamaskPage to connectWallet
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    // --- Vote on the Proposal via UI ---
    console.log(`${testLogPrefix} Attempting to vote via UI...`);
    const voteButton = page.getByRole('button', { name: 'Cast Your Vote' });
    await expect(voteButton).toBeVisible({ timeout: 30000 }); // Wait for button/proposal load
    await voteButton.click();

    const proposalTitle = await page
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent(); // DialogTitle selector
    expect(proposalTitle).toContain(proposalTitlePrefix); // Check it's the right proposal modal
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    // Interact with the Basic/Single-Choice Vote Modal
    const choiceToSelect = choices[1]; // Select the second choice (index 1)
    const expectedChoiceValue = 2; // 1-based index
    const choiceRadioButton = page.getByRole('radio', { name: choiceToSelect });
    await expect(choiceRadioButton).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    // Fill reason textarea
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await page.locator('textarea#reason').fill(uniqueReasonNonce);
    // Ensure attribution checkbox is checked (it should be by default)
    // await expect(page.locator('input#attribution')).toBeChecked();

    const submitVoteButton = page.getByRole('button', { name: 'Submit Vote' });
    await expect(submitVoteButton).toBeEnabled();
    await submitVoteButton.click();

    await page.waitForTimeout(1000);

    try {
      // Sometimes a "Got it" button appears before signing - handle it
      const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' }); // Use the passed metamaskPage
      if (await gotItButton.isVisible({ timeout: 3000 })) {
        console.log(`${testLogPrefix} Clicking 'Got it' button in Metamask...`);
        await gotItButton.click();
      }
    } catch (e) {
      console.log(
        `${testLogPrefix} 'Got it' button not found or clickable, continuing...`
      );
    }

    // --- Handle Metamask Signature ---
    console.log(`${testLogPrefix} Confirming vote signature in Metamask...`);
    await metamask.confirmSignature();

    console.log(
      `${testLogPrefix} Vote submitted via UI, waiting for API verification...`
    );
    await page.waitForTimeout(API_VERIFICATION_DELAY);

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId, // proposalId is now guaranteed non-null
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString, // Pass expected reason
      testLogPrefix
    );
  });

  // --- APPROVAL (MULTI-CHOICE) TEST ---
  test('[Approval] should use active or create proposal, vote multiple choices via UI, verify via API', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Approval]';
    const voteType = 'approval';
    const choices = [
      'Approve Multi 1',
      'Approve Multi 2',
      'Approve Multi 3',
      'Approve Multi 4',
    ];
    const proposalTitlePrefix = 'E2E Test Proposal (Approval Multi-Choice)';
    let proposalId: string | null = null;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`; // Assuming attribution checkbox is checked by default

    // --- Fetch Active or Create New Proposal ID ---
    proposalId = await fetchLatestActiveProposalId(
      voteType,
      proposalTitlePrefix,
      testLogPrefix
    );

    if (!proposalId) {
      console.log(
        `${testLogPrefix} No active proposal found. Creating a new one...`
      );
      const proposalData = await createSnapshotProposal(
        voteType,
        proposalTitlePrefix,
        'Automated test proposal for multi-choice approval voting.',
        choices,
        testLogPrefix
      );
      proposalId = proposalData.id;
    } else {
      console.log(
        `${testLogPrefix} Using existing active proposal: ${proposalId}`
      );
    }

    expect(
      proposalId,
      `${testLogPrefix} proposalId should be defined after fetch or create`
    ).toBeDefined();
    // Ensure proposalId is treated as non-null from here on
    proposalId = proposalId!;

    // --- Interact with the Web Application ---
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:61000/?story=vote-button--approval-proposal`
    );
    // Pass metamaskPage to connectWallet
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    // --- Vote on the Proposal via UI ---
    console.log(`${testLogPrefix} Attempting to vote via UI...`);
    const voteButton = page.getByRole('button', { name: 'Cast Your Vote' });
    await expect(voteButton).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const proposalTitle = await page
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent();
    expect(proposalTitle).toContain(proposalTitlePrefix);
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    // Interact with the Approval Vote Modal - SELECT MULTIPLE CHOICES
    const firstChoiceCheckbox = page.getByRole('checkbox', {
      name: choices[0],
    }); // Choice 1 (index 0)
    const thirdChoiceCheckbox = page.getByRole('checkbox', {
      name: choices[2],
    }); // Choice 3 (index 2)
    await expect(firstChoiceCheckbox).toBeVisible({ timeout: 10000 });
    await expect(thirdChoiceCheckbox).toBeVisible({ timeout: 10000 });

    await firstChoiceCheckbox.check(); // Select the first choice
    await thirdChoiceCheckbox.check(); // Select the third choice
    const expectedChoiceValue = [1, 3]; // 1-based indices of selected choices

    // Fill reason textarea
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await page.locator('textarea#reason').fill(uniqueReasonNonce);
    // Ensure attribution checkbox is checked (it should be by default)
    // await expect(page.locator('input#attribution')).toBeChecked();

    const submitVoteButton = page.getByRole('button', { name: 'Submit Vote' });
    await expect(submitVoteButton).toBeEnabled();
    await submitVoteButton.click();

    await page.waitForTimeout(1000);

    try {
      // Sometimes a "Got it" button appears before signing - handle it
      const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' }); // Use the passed metamaskPage
      if (await gotItButton.isVisible({ timeout: 3000 })) {
        console.log(`${testLogPrefix} Clicking 'Got it' button in Metamask...`);
        await gotItButton.click();
      }
    } catch (e) {
      console.log(
        `${testLogPrefix} 'Got it' button not found or clickable, continuing...`
      );
    }

    // --- Handle Metamask Signature ---
    console.log(`${testLogPrefix} Confirming vote signature in Metamask...`);
    await metamask.confirmSignature();

    console.log(
      `${testLogPrefix} Vote submitted via UI, waiting for API verification...`
    );
    await page.waitForTimeout(API_VERIFICATION_DELAY);

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId, // proposalId is now guaranteed non-null
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString, // Pass expected reason
      testLogPrefix
    );
  });

  // --- QUADRATIC TEST ---
  test('[Quadratic] should use active or create proposal, vote via UI, verify via API', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Quadratic]';
    const voteType = 'quadratic';
    const choices = ['Quad Choice A', 'Quad Choice B', 'Quad Choice C'];
    const proposalTitlePrefix = 'E2E Test Proposal (Quadratic)';
    let proposalId: string | null = null;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`; // Assuming attribution checkbox is checked by default

    // --- Fetch Active or Create New Proposal ID ---
    proposalId = await fetchLatestActiveProposalId(
      voteType,
      proposalTitlePrefix,
      testLogPrefix
    );

    if (!proposalId) {
      console.log(
        `${testLogPrefix} No active proposal found. Creating a new one...`
      );
      const proposalData = await createSnapshotProposal(
        voteType,
        proposalTitlePrefix,
        'Automated test proposal for quadratic voting.',
        choices,
        testLogPrefix
      );
      proposalId = proposalData.id;
    } else {
      console.log(
        `${testLogPrefix} Using existing active proposal: ${proposalId}`
      );
    }

    expect(
      proposalId,
      `${testLogPrefix} proposalId should be defined after fetch or create`
    ).toBeDefined();
    // Ensure proposalId is treated as non-null from here on
    proposalId = proposalId!;

    // --- Interact with the Web Application ---
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:61000/?story=vote-button--quadratic-proposal`
    );
    // Pass metamaskPage to connectWallet
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    // --- Vote on the Proposal via UI ---
    console.log(`${testLogPrefix} Attempting to vote via UI...`);
    const voteButton = page.getByRole('button', { name: 'Cast Your Vote' });
    await expect(voteButton).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const proposalTitle = await page
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent();
    expect(proposalTitle).toContain(proposalTitlePrefix);
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    // Interact with the Quadratic Vote Modal (using Radio buttons like Basic)
    const choiceToSelect = choices[0]; // Select the first choice (index 0)
    const choiceIndexString = '1'; // 1-based index as string for the object key
    const choiceRadioButton = page.getByRole('radio', { name: choiceToSelect });
    await expect(choiceRadioButton).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    // Expected choice for quadratic is an object like { "1": 1 }
    const expectedChoiceValue = { [choiceIndexString]: 1 };

    // Fill reason textarea
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await page.locator('textarea#reason').fill(uniqueReasonNonce);
    // Ensure attribution checkbox is checked (it should be by default)
    // await expect(page.locator('input#attribution')).toBeChecked();

    const submitVoteButton = page.getByRole('button', { name: 'Submit Vote' });
    await expect(submitVoteButton).toBeEnabled();
    await submitVoteButton.click();

    // Wait for metamask interaction - signature required for Quadratic
    await page.waitForTimeout(1000);

    try {
      // Sometimes a "Got it" button appears before signing - handle it
      const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' }); // Use the passed metamaskPage
      if (await gotItButton.isVisible({ timeout: 3000 })) {
        console.log(`${testLogPrefix} Clicking 'Got it' button in Metamask...`);
        await gotItButton.click();
      }
    } catch (e) {
      console.log(
        `${testLogPrefix} 'Got it' button not found or clickable, continuing...`
      );
    }

    // --- Handle Metamask Signature ---
    console.log(`${testLogPrefix} Confirming vote signature in Metamask...`);
    await metamask.confirmSignature();
    console.log(
      `${testLogPrefix} Vote submitted via UI, waiting for API verification...`
    );
    await page.waitForTimeout(API_VERIFICATION_DELAY);

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId, // proposalId is now guaranteed non-null
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString, // Pass expected reason
      testLogPrefix
    );
  });

  // --- RANKED CHOICE TEST ---
  test('[Ranked-Choice] should use active or create proposal, vote via UI (reorder), verify via API', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Ranked-Choice]';
    const voteType = 'ranked-choice';
    // Order: A, B, C, D
    const choices = ['Rank C A', 'Rank C B', 'Rank C C', 'Rank C D'];
    const proposalTitlePrefix = 'E2E Test Proposal (Ranked Choice)';
    let proposalId: string | null = null;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`; // Assuming attribution checkbox is checked by default

    // --- Fetch Active or Create New Proposal ID ---
    proposalId = await fetchLatestActiveProposalId(
      voteType,
      proposalTitlePrefix,
      testLogPrefix
    );

    if (!proposalId) {
      console.log(
        `${testLogPrefix} No active proposal found. Creating a new one...`
      );
      const proposalData = await createSnapshotProposal(
        voteType,
        proposalTitlePrefix,
        'Automated test proposal for ranked-choice voting.',
        choices,
        testLogPrefix
      );
      proposalId = proposalData.id;
    } else {
      console.log(
        `${testLogPrefix} Using existing active proposal: ${proposalId}`
      );
    }

    expect(
      proposalId,
      `${testLogPrefix} proposalId should be defined after fetch or create`
    ).toBeDefined();
    // Ensure proposalId is treated as non-null from here on
    proposalId = proposalId!;

    // --- Interact with the Web Application ---
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:61000/?story=vote-button--ranked-choice-proposal`
    );
    // Pass metamaskPage to connectWallet
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    // --- Vote on the Proposal via UI ---
    console.log(`${testLogPrefix} Attempting to vote via UI...`);
    const voteButton = page.getByRole('button', { name: 'Cast Your Vote' });
    await expect(voteButton).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const proposalTitle = await page
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent();
    expect(proposalTitle).toContain(proposalTitlePrefix);
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    // Interact with the Ranked Choice Vote Modal - Drag and Drop
    // Initial order: [A, B, C, D] (Indices: 1, 2, 3, 4)
    // Target order:  [C, A, D, B] (Indices: 3, 1, 4, 2)

    // Locate drag handles - using aria-label set in the component
    const dragHandleA = page.locator(`button[aria-label="Drag ${choices[0]}"]`); // Handle for A
    const dragHandleC = page.locator(`button[aria-label="Drag ${choices[2]}"]`); // Handle for C
    const dragHandleD = page.locator(`button[aria-label="Drag ${choices[3]}"]`); // Handle for D

    // Locate drop targets - the items themselves can act as targets
    // Get the first item in the list as the initial drop target
    const firstItemContainer = page
      .locator('div[data-headlessui-state="open"] li > div')
      .first();

    // Ensure items are visible before dragging
    await expect(dragHandleA).toBeVisible({ timeout: 10000 });
    await expect(dragHandleC).toBeVisible({ timeout: 10000 });
    await expect(dragHandleD).toBeVisible({ timeout: 10000 });
    await expect(firstItemContainer).toBeVisible({ timeout: 10000 });

    // Perform drags: Use dragTo for simplicity
    console.log(`${testLogPrefix} Reordering items: C -> 1st`);
    await dragHandleC.dragTo(firstItemContainer); // Move C to the position of A (becomes 1st)
    await page.waitForTimeout(500); // Small delay for UI update

    // New order should be: [C, A, B, D]
    // Locate items based on their new expected positions
    const itemA_newPosContainer = page
      .locator('div[data-headlessui-state="open"] li:nth-child(2) > div') // A is now 2nd
      .first();
    const itemB_newPosContainer = page
      .locator('div[data-headlessui-state="open"] li:nth-child(3) > div') // B is now 3rd
      .first();
    const dragHandleD_newPos = page.locator(
      `button[aria-label="Drag ${choices[3]}"]`
    ); // D is currently 4th

    await expect(itemA_newPosContainer).toBeVisible({ timeout: 5000 });
    await expect(itemB_newPosContainer).toBeVisible({ timeout: 5000 });
    await expect(dragHandleD_newPos).toBeVisible({ timeout: 5000 });

    console.log(`${testLogPrefix} Reordering items: D -> 3rd`);
    // Drag D to the position currently occupied by B (3rd position)
    await dragHandleD_newPos.dragTo(itemB_newPosContainer);
    await page.waitForTimeout(500);

    // Final Order Check (visually): Should be C, A, D, B
    // Corresponding 1-based indices: [3, 1, 4, 2]
    const expectedChoiceValue = [3, 1, 4, 2];

    // Fill reason textarea
    // Use a locator that finds the textarea associated with the "Reason (Optional)" label,
    const reasonTextarea = page.locator('label:has-text("Reason") + textarea');
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await expect(reasonTextarea).toBeVisible({ timeout: 5000 });
    await reasonTextarea.fill(uniqueReasonNonce);
    // Ensure attribution checkbox is checked (it should be by default)
    // await expect(page.locator('input#attribution')).toBeChecked();

    const submitVoteButton = page.getByRole('button', { name: 'Submit Vote' });
    await expect(submitVoteButton).toBeEnabled();
    await submitVoteButton.click();

    await page.waitForTimeout(1000);

    try {
      // Sometimes a "Got it" button appears before signing - handle it
      const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' }); // Use the passed metamaskPage
      if (await gotItButton.isVisible({ timeout: 3000 })) {
        console.log(`${testLogPrefix} Clicking 'Got it' button in Metamask...`);
        await gotItButton.click();
      }
    } catch (e) {
      console.log(
        `${testLogPrefix} 'Got it' button not found or clickable, continuing...`
      );
    }

    // --- Handle Metamask Signature ---
    console.log(`${testLogPrefix} Confirming vote signature in Metamask...`);
    await metamask.confirmSignature();

    await page.waitForTimeout(API_VERIFICATION_DELAY);

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId, // proposalId is now guaranteed non-null
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString, // Pass expected reason
      testLogPrefix
    );
  });

  // --- WEIGHTED TEST ---
  test('[Weighted] should use active or create proposal, vote via UI (distribute weight), verify via API', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Weighted]';
    const voteType = 'weighted';
    const choices = ['Weight Opt 1', 'Weight Opt 2', 'Weight Opt 3'];
    const proposalTitlePrefix = 'E2E Test Proposal (Weighted)';
    let proposalId: string | null = null;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`; // Assuming attribution checkbox is checked by default

    // --- Fetch Active or Create New Proposal ID ---
    proposalId = await fetchLatestActiveProposalId(
      voteType,
      proposalTitlePrefix,
      testLogPrefix
    );

    if (!proposalId) {
      console.log(
        `${testLogPrefix} No active proposal found. Creating a new one...`
      );
      const proposalData = await createSnapshotProposal(
        voteType,
        proposalTitlePrefix,
        'Automated test proposal for weighted voting.',
        choices,
        testLogPrefix
      );
      proposalId = proposalData.id;
    } else {
      console.log(
        `${testLogPrefix} Using existing active proposal: ${proposalId}`
      );
    }

    expect(
      proposalId,
      `${testLogPrefix} proposalId should be defined after fetch or create`
    ).toBeDefined();
    // Ensure proposalId is treated as non-null from here on
    proposalId = proposalId!;

    // --- Interact with the Web Application ---
    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:61000/?story=vote-button--weighted-proposal`
    );
    // Pass metamaskPage to connectWallet
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    // --- Vote on the Proposal via UI ---
    console.log(`${testLogPrefix} Attempting to vote via UI...`);
    const voteButton = page.getByRole('button', { name: 'Cast Your Vote' });
    await expect(voteButton).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const proposalTitle = await page
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent();
    expect(proposalTitle).toContain(proposalTitlePrefix);
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    // Interact with the Weighted Vote Modal - Enter weights
    // Distribute weights: Opt 1: 60%, Opt 2: 10%, Opt 3: 30%
    const weightInput1 = page
      .locator('label:has-text("Weight Opt 1")')
      .locator('..')
      .getByRole('spinbutton');
    const weightInput2 = page
      .locator('label:has-text("Weight Opt 2")')
      .locator('..')
      .getByRole('spinbutton');
    const weightInput3 = page
      .locator('label:has-text("Weight Opt 3")')
      .locator('..')
      .getByRole('spinbutton');

    await expect(weightInput1).toBeVisible({ timeout: 10000 });
    await weightInput1.fill('60');
    await weightInput2.fill('10');
    await weightInput3.fill('30');

    // Verify total is 100%
    await expect(page.locator('span:has-text("100%")')).toBeVisible();

    // Expected choice for weighted is an object mapping 1-based index string to weight: { "1": 60, "2": 10, "3": 30 }
    const expectedChoiceValue = { '1': 60, '2': 10, '3': 30 };

    // Fill reason textarea
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await page.locator('textarea#reason').fill(uniqueReasonNonce);
    // Ensure attribution checkbox is checked (it should be by default)
    // await expect(page.locator('input#attribution')).toBeChecked();

    const submitVoteButton = page.getByRole('button', { name: 'Submit Vote' });
    await expect(submitVoteButton).toBeEnabled();
    await submitVoteButton.click();

    await page.waitForTimeout(1000);

    try {
      // Sometimes a "Got it" button appears before signing - handle it
      const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' }); // Use the passed metamaskPage
      if (await gotItButton.isVisible({ timeout: 3000 })) {
        console.log(`${testLogPrefix} Clicking 'Got it' button in Metamask...`);
        await gotItButton.click();
      }
    } catch (e) {
      console.log(
        `${testLogPrefix} 'Got it' button not found or clickable, continuing...`
      );
    }

    // --- Handle Metamask Signature ---
    console.log(`${testLogPrefix} Confirming vote signature in Metamask...`);
    await metamask.confirmSignature();

    console.log(
      `${testLogPrefix} Vote submitted via UI, waiting for API verification...`
    );
    await page.waitForTimeout(API_VERIFICATION_DELAY);

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId, // proposalId is now guaranteed non-null
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString, // Pass expected reason
      testLogPrefix
    );
  });
});
