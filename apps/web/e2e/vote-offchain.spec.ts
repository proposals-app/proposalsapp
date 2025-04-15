import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { ethers } from 'ethers';
import snapshot from '@snapshot-labs/snapshot.js';
import basicSetup from './wallet-setup/basic.setup';
import fetch from 'cross-fetch';
import type { Page } from '@playwright/test';

const HUB_URL = 'https://testnet.hub.snapshot.org';
const SPACE_ID = 'proposalsapp-area51.eth';
const RPC_URL = 'https://arbitrum.drpc.org';
const SNAPSHOT_APP_NAME = 'proposalsapp';
const ATTRIBUTION_TEXT = 'voted via proposals.app'; // Match component constant

const TEST_TIMEOUT = 300 * 1000; // Increased timeout for potential API delays + UI interactions
const API_VERIFICATION_DELAY = 5 * 1000; // Wait 5 seconds before first API check
const API_RETRY_DELAY = 5 * 1000; // Wait 5 seconds between API check retries
const API_MAX_ATTEMPTS = 5; // Increased attempts for API verification

type SupportedVoteType =
  | 'basic'
  | 'single-choice'
  | 'approval'
  | 'quadratic'
  | 'ranked-choice'
  | 'weighted';

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

// Fisher-Yates (aka Knuth) Shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements
  }
  return shuffled;
}

// Generate random weights that sum to a specific total (default 100)
function generateWeights(n: number, total: number = 100): number[] {
  const weights = Array(n)
    .fill(0)
    .map(() => Math.random());
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const normalizedWeights = weights.map((w) => Math.round((w / sum) * total));

  // Adjust sum due to rounding
  let currentSum = normalizedWeights.reduce((acc, w) => acc + w, 0);
  let diff = total - currentSum;

  // Distribute difference (usually small)
  let i = 0;
  while (diff !== 0) {
    const adjustment = diff > 0 ? 1 : -1;
    // Ensure weight doesn't go below 0
    if (normalizedWeights[i % n] + adjustment >= 0) {
      normalizedWeights[i % n] += adjustment;
      diff -= adjustment;
    }
    i++;
    // Prevent infinite loops in edge cases (shouldn't happen with Math.round)
    if (i > n * 2 && diff !== 0) {
      console.warn('Weight adjustment loop took too long, breaking.');
      // Force sum - adjust the first element
      normalizedWeights[0] += diff;
      break;
    }
  }

  // Ensure no negative weights after adjustment
  return normalizedWeights.map((w) => Math.max(0, w));
}

async function connectWallet(
  page: Page, // Use imported Page type
  metamask: MetaMask,
  metamaskPage: Page, // Use imported Page type
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
  voteType: SupportedVoteType,
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
  voteType: SupportedVoteType,
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

/**
 * Fetches the latest active proposal ID matching the criteria, or creates a new one if none is found.
 * @returns The proposal ID (guaranteed non-null string).
 * @throws If fetching fails and creation also fails, or if proposalId remains undefined.
 */
async function getOrCreateActiveProposal(
  voteType: SupportedVoteType,
  titlePrefix: string,
  bodyText: string, // Needed for creation
  choices: string[], // Needed for creation
  testLogPrefix: string = ''
): Promise<string> {
  let proposalId: string | null = null;

  proposalId = await fetchLatestActiveProposalId(
    voteType,
    titlePrefix,
    testLogPrefix
  );

  if (proposalId) {
    console.log(
      `${testLogPrefix} Found existing active proposal: ${proposalId}`
    );
  } else {
    console.log(
      `${testLogPrefix} No active proposal found. Creating a new one...`
    );
    try {
      const proposalData = await createSnapshotProposal(
        voteType,
        titlePrefix,
        bodyText, // Use the provided body text
        choices,
        testLogPrefix
      );
      proposalId = proposalData.id;
      console.log(
        `${testLogPrefix} Successfully created proposal: ${proposalId}`
      );
    } catch (error) {
      console.error(
        `${testLogPrefix} Failed to create proposal after not finding an active one.`,
        error
      );
      // Re-throw to fail the test clearly
      throw new Error(
        `[${testLogPrefix}] Failed to get or create proposal: ${error}`
      );
    }
  }

  // Ensure proposalId is now defined. If not, something went wrong in fetch/create logic.
  if (!proposalId) {
    throw new Error(
      `[${testLogPrefix}] Critical error: proposalId is null after attempting fetch and create.`
    );
  }

  return proposalId; // Guaranteed non-null string here
}

async function verifyVoteViaApi(
  proposalId: string,
  voterAddress: string,
  expectedChoice: any,
  expectedReasonContains: string,
  testLogPrefix: string = ''
): Promise<void> {
  console.log(
    `${testLogPrefix} Verifying vote for proposal: ${proposalId} by voter: ${voterAddress}`
  );
  console.log(
    `${testLogPrefix} Expecting reason to contain: "${expectedReasonContains}"`
  );
  console.log(
    `${testLogPrefix} Expecting choice: ${JSON.stringify(expectedChoice)}`
  ); // Log expected choice

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
          expect(
            foundVote.choice,
            `Choice verification failed. Expected: ${JSON.stringify(expectedChoice)}, Got: ${JSON.stringify(foundVote.choice)}`
          ).toEqual(expectedChoice);
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
    `Vote verification failed after ${API_MAX_ATTEMPTS} attempts. See logs for details. Last error: ${lastError}. Expected choice: ${JSON.stringify(expectedChoice)}. Expected reason to contain: "${expectedReasonContains}"`
  ).toBe(true); // Updated error message
}

/**
 * Submits the vote via the UI, handles Metamask confirmation, and waits for verification delay.
 */
async function submitVoteAndConfirmMetamask(
  page: Page, // Use imported Page type
  metamaskPage: Page, // Use imported Page type
  metamask: MetaMask,
  testLogPrefix: string = '',
  apiVerificationDelay: number = API_VERIFICATION_DELAY // Allow overriding delay if needed
) {
  const submitVoteButton = page.getByRole('button', { name: 'Submit Vote' });
  await expect(submitVoteButton).toBeEnabled();
  await submitVoteButton.click();

  await page.waitForTimeout(1000); // Short wait before checking Metamask

  try {
    const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' });
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
    `${testLogPrefix} Vote submitted via UI, waiting ${apiVerificationDelay / 1000}s for API verification...`
  );
  await page.waitForTimeout(apiVerificationDelay);
}

// --- Enforce Sequential Execution ---
test.describe.serial('Offchain Voting E2E Tests', () => {
  // --- BASIC ---
  test('[Basic] should use active or create proposal, vote random choice via UI, verify via API', async ({
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
    const proposalBody = 'Automated test proposal for basic voting.';
    let proposalId: string;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    // --- Get or Create Proposal ID ---
    proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

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

    // Interact with the Basic/Single-Choice Vote Modal - RANDOM CHOICE
    const randomIndex = Math.floor(Math.random() * choices.length);
    const choiceToSelect = choices[randomIndex];
    const expectedChoiceValue = randomIndex + 1; // 1-based index
    console.log(
      `${testLogPrefix} Randomly selected choice: "${choiceToSelect}" (Index: ${randomIndex}, Expected API Value: ${expectedChoiceValue})`
    );

    const choiceRadioButton = page.getByRole('radio', { name: choiceToSelect });
    await expect(choiceRadioButton).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    // Fill reason textarea
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await page.locator('textarea#reason').fill(uniqueReasonNonce);

    // --- Submit Vote and Confirm ---
    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
  });

  // --- SINGLE CHOICE ---
  test('[Single-Choice] should use active or create proposal, vote random choice via UI, verify via API', async ({
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
    const proposalBody = 'Automated test proposal for single-choice voting.';
    let proposalId: string;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    // --- Get or Create Proposal ID ---
    proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

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

    // Interact with the Basic/Single-Choice Vote Modal - RANDOM CHOICE
    const randomIndex = Math.floor(Math.random() * choices.length);
    const choiceToSelect = choices[randomIndex];
    const expectedChoiceValue = randomIndex + 1; // 1-based index
    console.log(
      `${testLogPrefix} Randomly selected choice: "${choiceToSelect}" (Index: ${randomIndex}, Expected API Value: ${expectedChoiceValue})`
    );

    const choiceRadioButton = page.getByRole('radio', { name: choiceToSelect });
    await expect(choiceRadioButton).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    // Fill reason textarea
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await page.locator('textarea#reason').fill(uniqueReasonNonce);

    // --- Submit Vote and Confirm ---
    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
  });

  // --- APPROVAL (MULTI-CHOICE) TEST ---
  test('[Approval] should use active or create proposal, vote random multiple choices via UI, verify via API', async ({
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
    const proposalBody =
      'Automated test proposal for multi-choice approval voting.';
    let proposalId: string;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    // --- Get or Create Proposal ID ---
    proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

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

    // Interact with the Approval Vote Modal - SELECT RANDOM MULTIPLE CHOICES
    const numChoices = choices.length;
    const numToSelect = Math.floor(Math.random() * numChoices) + 1; // Select 1 to numChoices
    const availableIndices = Array.from(Array(numChoices).keys()); // [0, 1, ..., n-1]
    const selectedIndices = shuffleArray(availableIndices).slice(
      0,
      numToSelect
    ); // Get random unique indices

    const selectedChoiceTexts: string[] = [];
    for (const index of selectedIndices) {
      const choiceToSelect = choices[index];
      selectedChoiceTexts.push(choiceToSelect);
      const choiceCheckbox = page.getByRole('checkbox', {
        name: choiceToSelect,
      });
      await expect(choiceCheckbox).toBeVisible({ timeout: 10000 });
      await choiceCheckbox.check();
    }
    // Expected choice is an array of 1-based indices
    const expectedChoiceValue = selectedIndices.map((i) => i + 1);

    console.log(
      `${testLogPrefix} Randomly selected ${numToSelect} choices: ${JSON.stringify(selectedChoiceTexts)}`
    );
    console.log(
      `${testLogPrefix} Selected indices (0-based): ${JSON.stringify(selectedIndices)}`
    );
    console.log(
      `${testLogPrefix} Expected API choice value (1-based, sorted): ${JSON.stringify(expectedChoiceValue)}`
    );

    // Fill reason textarea
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await page.locator('textarea#reason').fill(uniqueReasonNonce);

    // --- Submit Vote and Confirm ---
    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
  });

  // --- QUADRATIC TEST ---
  test('[Quadratic] should use active or create proposal, vote random choice via UI, verify via API', async ({
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
    const proposalBody = 'Automated test proposal for quadratic voting.';
    let proposalId: string;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    // --- Get or Create Proposal ID ---
    proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

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

    // Interact with the Quadratic Vote Modal - RANDOM CHOICE
    const randomIndex = Math.floor(Math.random() * choices.length);
    const choiceToSelect = choices[randomIndex];
    const choiceIndexString = (randomIndex + 1).toString(); // 1-based index as string key
    // Expected choice for quadratic is an object like { "index": 1 }
    const expectedChoiceValue = { [choiceIndexString]: 1 };
    console.log(
      `${testLogPrefix} Randomly selected choice: "${choiceToSelect}" (Index: ${randomIndex}, Expected API Value: ${JSON.stringify(expectedChoiceValue)})`
    );

    const choiceRadioButton = page.getByRole('radio', { name: choiceToSelect });
    await expect(choiceRadioButton).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    // Fill reason textarea
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await page.locator('textarea#reason').fill(uniqueReasonNonce);

    // --- Submit Vote and Confirm ---
    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
  });

  // --- RANKED CHOICE TEST ---
  test('[Ranked-Choice] should use active or create proposal, vote via UI (random single swap), verify via API', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Ranked-Choice]';
    const voteType = 'ranked-choice';
    // Initial Order: A, B, C, D (indices 1, 2, 3, 4)
    const choices = ['Rank C A', 'Rank C B', 'Rank C C', 'Rank C D'];
    const proposalTitlePrefix = 'E2E Test Proposal (Ranked Choice)';
    const proposalBody = 'Automated test proposal for ranked-choice voting.';
    let proposalId: string;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    // --- Get or Create Proposal ID ---
    proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

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

    // --- Interact with Ranked Choice Modal using a RANDOM SINGLE SWAP ---
    const sortableItemContainerSelector =
      'div[role="dialog"] >> div.rounded-md.border > div';
    const getDragHandleLocator = (choiceText: string) =>
      page.locator(
        `${sortableItemContainerSelector}:has-text("${choiceText}") >> button[aria-label^="Drag"]`
      );
    const getItemContainerByText = (choiceText: string) =>
      page.locator(
        `${sortableItemContainerSelector}:has-text("${choiceText}")`
      );

    // Ensure list container and items are rendered
    await expect(
      page.locator(sortableItemContainerSelector).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator(sortableItemContainerSelector)).toHaveCount(
      choices.length,
      { timeout: 10000 }
    );
    console.log(`${testLogPrefix} Ranked choice items rendered.`);

    // --- Perform Random Swap ---
    const currentOrderIndices = choices.map((_, i) => i + 1); // Initial: [1, 2, 3, 4]
    let currentOrderTexts = [...choices]; // Initial: ['A', 'B', 'C', 'D']

    // Choose a random index to swap with the next item
    const swapIndex = Math.floor(Math.random() * (choices.length - 1)); // 0, 1, or 2 for length 4
    const itemToMoveIndex = swapIndex + 1;

    const itemToMoveText = currentOrderTexts[itemToMoveIndex];
    const targetItemText = currentOrderTexts[swapIndex];

    console.log(
      `${testLogPrefix} Performing random swap: Moving "${itemToMoveText}" (currently at pos ${itemToMoveIndex + 1}) before "${targetItemText}" (currently at pos ${swapIndex + 1})`
    );

    const sourceHandle = getDragHandleLocator(itemToMoveText);
    const targetContainer = getItemContainerByText(targetItemText);

    await expect(sourceHandle).toBeVisible({ timeout: 5000 });
    await expect(targetContainer).toBeVisible({ timeout: 5000 });

    const sourceBox = await sourceHandle.boundingBox();
    const targetBox = await targetContainer.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error(
        `Could not get bounding box for drag elements (Swap ${itemToMoveText} and ${targetItemText})`
      );
    }

    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2
    );
    await page.mouse.down();
    await page.waitForTimeout(200);
    // Move slightly above the target item's center to drop before it
    await page.mouse.move(
      targetBox.x + targetBox.width / 2,
      targetBox.y + 5, // Adjust slightly to drop *before*
      { steps: 5 }
    );
    await page.waitForTimeout(500);
    await page.mouse.up();
    await page.waitForTimeout(1000); // Wait for UI to settle
    console.log(`${testLogPrefix} Drag operation completed.`);

    // --- Calculate Expected Order After Swap ---
    // Swap the elements in the tracking arrays
    [currentOrderTexts[swapIndex], currentOrderTexts[itemToMoveIndex]] = [
      currentOrderTexts[itemToMoveIndex],
      currentOrderTexts[swapIndex],
    ];
    [currentOrderIndices[swapIndex], currentOrderIndices[itemToMoveIndex]] = [
      currentOrderIndices[itemToMoveIndex],
      currentOrderIndices[swapIndex],
    ];

    const expectedChoiceValue = currentOrderIndices;

    // --- Verification after drag (using nth locator) ---
    console.log(`${testLogPrefix} Verifying visual order after drag...`);
    console.log(
      `${testLogPrefix} Expected final order (texts): ${JSON.stringify(currentOrderTexts)}`
    );
    console.log(
      `${testLogPrefix} Expected API choice value (1-based indices): ${JSON.stringify(expectedChoiceValue)}`
    );

    for (let i = 0; i < currentOrderTexts.length; i++) {
      const expectedText = currentOrderTexts[i];
      const itemLocator = page.locator(sortableItemContainerSelector).nth(i);
      // Check that the container at the i-th position contains the expected text
      await expect(
        itemLocator,
        `Item at position ${i + 1} should contain text "${expectedText}"`
      ).toContainText(expectedText, { timeout: 5000 }); // Added timeout for robustness
      console.log(
        `${testLogPrefix} Verified item at pos ${i + 1} contains "${expectedText}"`
      );
    }
    console.log(`${testLogPrefix} Visual order verified successfully.`);

    // --- Fill Reason and Submit ---
    const reasonTextarea = page.locator(
      'div[role="dialog"] >> textarea[id^="reason-"]'
    );
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await expect(reasonTextarea).toBeVisible({ timeout: 5000 });
    await reasonTextarea.fill(uniqueReasonNonce);

    // --- Submit Vote and Confirm ---
    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    // --- Verify Vote via Snapshot API ---
    console.log(
      `${testLogPrefix} Verifying vote via API with expected order: ${JSON.stringify(expectedChoiceValue)}`
    );
    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
    console.log(`${testLogPrefix} Test completed.`);
  });

  // --- WEIGHTED TEST ---
  test('[Weighted] should use active or create proposal, vote via UI (random weight distribution), verify via API', async ({
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
    const proposalBody = 'Automated test proposal for weighted voting.';
    let proposalId: string;
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    // --- Get or Create Proposal ID ---
    proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

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

    // Interact with the Weighted Vote Modal - RANDOM WEIGHTS
    const weights = generateWeights(choices.length, 100);
    const expectedChoiceValue: { [key: string]: number } = {};

    console.log(`${testLogPrefix} Generated random weights: ${weights}`);

    for (let i = 0; i < choices.length; i++) {
      const choiceText = choices[i];
      const weight = weights[i];
      const choiceIndexString = (i + 1).toString(); // 1-based index string

      console.log(
        `${testLogPrefix} Setting weight for "${choiceText}" (Index: ${i}) to ${weight}%`
      );

      const weightInput = page
        .locator(`label:has-text("${choiceText}")`)
        .locator('..') // Go up to the parent div containing label and input
        .getByRole('spinbutton');

      await expect(weightInput).toBeVisible({ timeout: 10000 });
      // Clear existing value before filling
      await weightInput.fill('');
      await weightInput.fill(weight.toString());

      expectedChoiceValue[choiceIndexString] = weight;
    }

    console.log(
      `${testLogPrefix} Expected API choice value: ${JSON.stringify(expectedChoiceValue)}`
    );

    // Verify total is 100%
    await expect(page.getByText('100%', { exact: true })).toBeVisible({
      timeout: 5000,
    });

    // Fill reason textarea
    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await page.locator('textarea#reason').fill(uniqueReasonNonce);

    // --- Submit Vote and Confirm ---
    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    // --- Verify Vote via Snapshot API ---
    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
  });
});
