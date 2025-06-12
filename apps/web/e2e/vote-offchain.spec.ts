import { testWithSynpress } from '@synthetixio/synpress';
import { MetaMask, metaMaskFixtures } from '@synthetixio/synpress/playwright';
import { ethers } from 'ethers';
import snapshot from '@snapshot-labs/snapshot.js';
import basicSetup from './wallet-setup/basic.setup';
import fetch from 'cross-fetch';
import type { Locator, Page } from '@playwright/test';

const HUB_URL = 'https://testnet.hub.snapshot.org';
const SPACE_ID = 'proposalsapp-area51.eth';
const RPC_URL = 'https://arbitrum.drpc.org';
const SNAPSHOT_APP_NAME = 'proposalsapp';
const ATTRIBUTION_TEXT = 'voted via proposals.app';

const TEST_TIMEOUT = 300 * 1000;
const API_VERIFICATION_DELAY = 5 * 1000;
const API_RETRY_DELAY = 5 * 1000;
const API_MAX_ATTEMPTS = 5;

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
  relayer?: { address: string; receipt: string };
}

interface SnapshotVote {
  id: string;
  ipfs: string;
  voter: string;
  choice: any;
  created: number;
  reason: string;
  app: string;
}

interface SnapshotProposal {
  id: string;
  type: string;
  title: string;
  created: number;
  end: number;
}

const seedPhrase = process.env.TEST_ACCOUNT_SEED_PHRASE;
if (!seedPhrase) {
  throw new Error(
    'TEST_ACCOUNT_SEED_PHRASE environment variable is not set. Please configure it for test execution.'
  );
}

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generateWeights(n: number, total: number = 100): number[] {
  const weights = Array(n)
    .fill(0)
    .map(() => Math.random());
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const normalizedWeights = weights.map((w) => Math.round((w / sum) * total));

  const currentSum = normalizedWeights.reduce((acc, w) => acc + w, 0);
  let diff = total - currentSum;

  let i = 0;
  while (diff !== 0) {
    const adjustment = diff > 0 ? 1 : -1;
    if (normalizedWeights[i % n] + adjustment >= 0) {
      normalizedWeights[i % n] += adjustment;
      diff -= adjustment;
    }
    i++;
    if (i > n * 2 && diff !== 0) {
      console.warn('Weight adjustment loop exceeded iterations, forcing sum.');
      normalizedWeights[0] += diff;
      break;
    }
  }

  return normalizedWeights.map((w) => Math.max(0, w));
}

async function getStorybookFrame(page: Page, testLogPrefix: string = '') {
  const iframe = page.locator('iframe[title="storybook-preview-iframe"]');
  await expect(
    iframe,
    `${testLogPrefix} Storybook iframe should be visible`
  ).toBeVisible({ timeout: 10000 });

  const frame = await iframe.contentFrame();
  if (!frame) {
    throw new Error(`${testLogPrefix} Could not access iframe content`);
  }
  return frame;
}

async function connectWallet(
  page: Page,
  metamask: MetaMask,
  metamaskPage: Page,
  testLogPrefix: string = ''
) {
  console.log(`${testLogPrefix} Connecting wallet...`);

  const frame = await getStorybookFrame(page, testLogPrefix);

  await expect(
    frame.getByTestId('rk-connect-button'),
    `${testLogPrefix} RainbowKit Connect button should be visible`
  ).toBeVisible({ timeout: 20000 });

  await frame.getByTestId('rk-connect-button').click();
  await frame.getByTestId('rk-wallet-option-io.metamask').click();

  await metamask.connectToDapp();

  try {
    const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' });
    if (await gotItButton.isVisible({ timeout: 3000 })) {
      console.log(`${testLogPrefix} Handling Metamask 'Got it' button...`);
      await gotItButton.click();
    }
  } catch (_e) {
    console.log(`${testLogPrefix} 'Got it' button not found, continuing...`);
  }

  try {
    await metamask.approveNewNetwork();
  } catch (_e) {
    console.log(
      `${testLogPrefix} Approve new network skipped/failed, continuing...`
    );
  }
  try {
    await metamask.approveSwitchNetwork();
  } catch (_e) {
    console.log(
      `${testLogPrefix} Approve switch network skipped/failed, continuing...`
    );
  }
  console.log(`${testLogPrefix} Wallet connected.`);
}

async function createSnapshotProposal(
  voteType: SupportedVoteType,
  titlePrefix: string,
  bodyText: string,
  choices: string[],
  testLogPrefix: string = ''
): Promise<{ id: string; signerAddress: string; wallet: ethers.Wallet }> {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = ethers.Wallet.fromMnemonic(seedPhrase!).connect(provider);
  const signerAddress = await wallet.getAddress();
  const currentBlock = await provider.getBlockNumber();

  console.log(`${testLogPrefix} Using signer address: ${signerAddress}`);
  console.log(
    `${testLogPrefix} Using network: ${await provider.getNetwork().then((n) => n.name)}`
  );
  console.log(`${testLogPrefix} Latest block number: ${currentBlock}`);

  const client = new snapshot.Client712(HUB_URL);
  const startAt = Math.floor(new Date().getTime() / 1000) - 60;
  const endAt = startAt + 60 * 60 * 24 * 30;

  const proposalTitle = `${titlePrefix} - ${new Date().toISOString()}`;
  let proposalReceipt: ProposalReceipt;
  let proposalId = '';

  try {
    console.log(`${testLogPrefix} Creating proposal: "${proposalTitle}"...`);
    proposalReceipt = (await client.proposal(wallet, signerAddress, {
      space: SPACE_ID,
      type: voteType,
      title: proposalTitle,
      body: bodyText,
      choices,
      start: startAt,
      end: endAt,
      snapshot: currentBlock,
      plugins: JSON.stringify({}),
      app: 'proposalsapp-e2e-test',
      discussion: '',
    })) as ProposalReceipt;

    proposalId = proposalReceipt.id;
    console.log(
      `${testLogPrefix} Proposal created successfully:`,
      proposalReceipt
    );
    console.log(`${testLogPrefix} Proposal ID: ${proposalId}`);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (error: any) {
    console.error(`${testLogPrefix} Error creating proposal:`, error);
    throw new Error(
      `[${voteType}] Failed to create proposal: ${error.message || error}`
    );
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
    `${testLogPrefix} Fetching latest active proposal ID for type: ${voteType} (Ending after ${currentTimestamp})...`
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
            end_gt: $currentTimestamp
          }
          orderBy: "created"
          orderDirection: desc
        ) {
          id
          type
          title
          created
          end
        }
      }
    `,
    variables: {
      spaceId: SPACE_ID,
      type: voteType,
      titlePrefix,
      currentTimestamp,
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
      const errorText = await response.text();
      console.error(
        `${testLogPrefix} Snapshot API query failed with status ${response.status}: ${errorText}`
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
        `${testLogPrefix} No active proposals found for type: ${voteType} and title prefix: ${titlePrefix}`
      );
      return null;
    }

    const latestProposal = jsonResponse.data.proposals[0] as SnapshotProposal;
    console.log(
      `${testLogPrefix} Latest active proposal ID found: ${latestProposal.id} (Title: "${latestProposal.title}", Ends: ${latestProposal.end})`
    );
    return latestProposal.id;
  } catch (error: any) {
    console.error(
      `${testLogPrefix} Error fetching latest active proposal ID: ${error}`
    );
    return null;
  }
}

async function getOrCreateActiveProposal(
  voteType: SupportedVoteType,
  titlePrefix: string,
  bodyText: string,
  choices: string[],
  testLogPrefix: string = ''
): Promise<string> {
  let proposalId: string | null = await fetchLatestActiveProposalId(
    voteType,
    titlePrefix,
    testLogPrefix
  );

  if (proposalId) {
    console.log(
      `${testLogPrefix} Found existing active proposal: ${proposalId}`
    );
    return proposalId;
  }

  console.log(`${testLogPrefix} No active proposal found. Creating new one...`);
  try {
    const proposalData = await createSnapshotProposal(
      voteType,
      titlePrefix,
      bodyText,
      choices,
      testLogPrefix
    );
    proposalId = proposalData.id;
    console.log(
      `${testLogPrefix} Successfully created proposal: ${proposalId}`
    );
    return proposalId;
  } catch (error) {
    console.error(
      `${testLogPrefix} Failed to create proposal after not finding an active one.`,
      error
    );
    throw new Error(
      `[${testLogPrefix}] Failed to get or create proposal: ${error}`
    );
  }
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
      proposalId,
      voterAddress,
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
          foundVote = jsonResponse.data.votes[0] as SnapshotVote;

          expect(
            foundVote,
            `${testLogPrefix} Vote object should be defined in API response`
          ).toBeDefined();
          expect(
            foundVote.id,
            `${testLogPrefix} Vote ID should be defined in API response`
          ).toBeDefined();
          expect(
            typeof foundVote.id,
            `${testLogPrefix} Vote ID should be a string`
          ).toBe('string');
          expect(
            foundVote.id.length,
            `${testLogPrefix} Vote ID length should be greater than 10`
          ).toBeGreaterThan(10);
          expect(
            foundVote.voter.toLowerCase(),
            `${testLogPrefix} Voter address mismatch`
          ).toBe(voterAddress.toLowerCase());
          expect(foundVote.app, `${testLogPrefix} App name mismatch`).toBe(
            SNAPSHOT_APP_NAME
          );
          expect(
            foundVote.choice,
            `${testLogPrefix} Choice verification failed. Expected: ${JSON.stringify(expectedChoice)}, Got: ${JSON.stringify(foundVote.choice)}`
          ).toEqual(expectedChoice);
          expect(
            foundVote.reason,
            `${testLogPrefix} Reason should contain expected text. Expected to contain: "${expectedReasonContains}", Got: "${foundVote.reason}"`
          ).toContain(expectedReasonContains);

          console.log(
            `${testLogPrefix} [Attempt ${attempt}] Vote successfully verified via Snapshot API (ID: ${foundVote.id}).`
          );
          voteVerified = true;
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
  }

  if (!voteVerified) {
    console.error(
      `${testLogPrefix} Final verification attempt failed. Last error:`,
      lastError
    );
    console.error(`${testLogPrefix} Last API vote data (if any):`, foundVote);
  }

  expect(
    voteVerified,
    `${testLogPrefix} Vote verification failed after ${API_MAX_ATTEMPTS} attempts. Last error: ${lastError}. Expected choice: ${JSON.stringify(expectedChoice)}. Expected reason to contain: "${expectedReasonContains}"`
  ).toBe(true);
}

async function handlePotentialGotItButton(
  metamaskPage: Page,
  testLogPrefix: string = '',
  maxAttempts: number = 3
) {
  console.log(`${testLogPrefix} Checking for Metamask 'Got it' button...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const gotItButton = metamaskPage.getByRole('button', { name: 'Got it' });
      const isVisible = await gotItButton.isVisible({ timeout: 2000 });

      if (isVisible) {
        console.log(
          `${testLogPrefix} 'Got it' button found on attempt ${attempt}, clicking...`
        );
        await gotItButton.click();
        console.log(`${testLogPrefix} 'Got it' button clicked successfully.`);
        return true;
      } else if (attempt < maxAttempts) {
        console.log(
          `${testLogPrefix} 'Got it' button not visible on attempt ${attempt}, waiting before next check...`
        );
        await metamaskPage.waitForTimeout(1000);
      }
    } catch (e) {
      console.log(
        `${testLogPrefix} Error checking for 'Got it' button on attempt ${attempt}: ${e}`
      );
      if (attempt < maxAttempts) {
        await metamaskPage.waitForTimeout(1000);
      }
    }
  }

  console.log(
    `${testLogPrefix} 'Got it' button did not appear after ${maxAttempts} attempts, continuing.`
  );
  return false;
}

async function submitVoteAndConfirmMetamask(
  page: Page,
  metamaskPage: Page,
  metamask: MetaMask,
  testLogPrefix: string = '',
  apiVerificationDelay: number = API_VERIFICATION_DELAY
) {
  const frame = await getStorybookFrame(page, testLogPrefix);
  const submitVoteButton = frame.getByRole('button', { name: 'Submit Vote' });
  await expect(
    submitVoteButton,
    `${testLogPrefix} Submit Vote button should be enabled`
  ).toBeEnabled();
  await submitVoteButton.click();

  await metamaskPage.waitForTimeout(1000);
  await handlePotentialGotItButton(metamaskPage, testLogPrefix);

  console.log(`${testLogPrefix} Confirming vote signature in Metamask...`);
  await metamask.confirmSignature();

  console.log(
    `${testLogPrefix} Vote submitted via UI, waiting ${apiVerificationDelay / 1000}s for API verification...`
  );
  await page.waitForTimeout(apiVerificationDelay);
}

test.describe.serial('Offchain Voting E2E Tests', () => {
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
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    const proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:6006/?path=/story/vote-button--snapshot-basic&viewMode=story&nav=false&panel=false&toolbar=false`
    );
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    console.log(`${testLogPrefix} Voting via UI...`);
    const frame = await getStorybookFrame(page, testLogPrefix);

    const voteButton = frame.getByRole('button', { name: 'Cast Your Vote' });
    await expect(
      voteButton,
      `${testLogPrefix} Cast Your Vote button should be visible`
    ).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const proposalTitle = await frame
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent();
    expect(
      proposalTitle,
      `${testLogPrefix} Modal title should contain proposal title prefix`
    ).toContain(proposalTitlePrefix);
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    const randomIndex = Math.floor(Math.random() * choices.length);
    const choiceToSelect = choices[randomIndex];
    const expectedChoiceValue = randomIndex + 1;
    console.log(
      `${testLogPrefix} Randomly selected choice: "${choiceToSelect}" (Index: ${randomIndex}, Expected API Value: ${expectedChoiceValue})`
    );

    const choiceRadioButton = frame
      .locator('div[role="dialog"]')
      .getByRole('radio', { name: choiceToSelect });
    await expect(
      choiceRadioButton,
      `${testLogPrefix} Choice radio button should be visible`
    ).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await frame
      .locator('textarea#reason')
      .fill(uniqueReasonNonce, { timeout: 1000 });

    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
  });

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
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    const proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:6006/?path=/story/vote-button--snapshot-single-choice&viewMode=story&nav=false&panel=false&toolbar=false`
    );
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    console.log(`${testLogPrefix} Voting via UI...`);
    const frame = await getStorybookFrame(page, testLogPrefix);

    const voteButton = frame.getByRole('button', { name: 'Cast Your Vote' });
    await expect(
      voteButton,
      `${testLogPrefix} Cast Your Vote button should be visible`
    ).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const proposalTitle = await frame
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent();
    expect(
      proposalTitle,
      `${testLogPrefix} Modal title should contain proposal title prefix`
    ).toContain(proposalTitlePrefix);
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    const randomIndex = Math.floor(Math.random() * choices.length);
    const choiceToSelect = choices[randomIndex];
    const expectedChoiceValue = randomIndex + 1;
    console.log(
      `${testLogPrefix} Randomly selected choice: "${choiceToSelect}" (Index: ${randomIndex}, Expected API Value: ${expectedChoiceValue})`
    );

    const choiceRadioButton = frame
      .locator('div[role="dialog"]')
      .getByRole('radio', { name: choiceToSelect });
    await expect(
      choiceRadioButton,
      `${testLogPrefix} Choice radio button should be visible`
    ).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await frame
      .locator('textarea#reason')
      .fill(uniqueReasonNonce, { timeout: 1000 });

    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
  });

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
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    const proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:6006/?path=/story/vote-button--snapshot-approval&viewMode=story&nav=false&panel=false&toolbar=false`
    );
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    console.log(`${testLogPrefix} Voting via UI...`);
    const frame = await getStorybookFrame(page, testLogPrefix);

    const voteButton = frame.getByRole('button', { name: 'Cast Your Vote' });
    await expect(
      voteButton,
      `${testLogPrefix} Cast Your Vote button should be visible`
    ).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const proposalTitle = await frame
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent();
    expect(
      proposalTitle,
      `${testLogPrefix} Modal title should contain proposal title prefix`
    ).toContain(proposalTitlePrefix);
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    const numChoices = choices.length;
    const numToSelect = Math.floor(Math.random() * numChoices) + 1;
    const availableIndices = Array.from(Array(numChoices).keys());
    const selectedIndices = shuffleArray(availableIndices).slice(
      0,
      numToSelect
    );

    const selectedChoiceTexts: string[] = [];
    for (const index of selectedIndices) {
      const choiceToSelect = choices[index];
      selectedChoiceTexts.push(choiceToSelect);
      const choiceCheckbox = frame
        .locator('div[role="dialog"]')
        .getByRole('checkbox', { name: choiceToSelect });
      await expect(
        choiceCheckbox,
        `${testLogPrefix} Choice checkbox for "${choiceToSelect}" should be visible`
      ).toBeVisible({ timeout: 10000 });
      await choiceCheckbox.check();
    }
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

    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await frame
      .locator('textarea#reason')
      .fill(uniqueReasonNonce, { timeout: 1000 });

    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
  });

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
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    const proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:6006/?path=/story/vote-button--snapshot-quadratic&viewMode=story&nav=false&panel=false&toolbar=false`
    );
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    console.log(`${testLogPrefix} Voting via UI...`);
    const frame = await getStorybookFrame(page, testLogPrefix);

    const voteButton = frame.getByRole('button', { name: 'Cast Your Vote' });
    await expect(
      voteButton,
      `${testLogPrefix} Cast Your Vote button should be visible`
    ).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const proposalTitle = await frame
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent();
    expect(
      proposalTitle,
      `${testLogPrefix} Modal title should contain proposal title prefix`
    ).toContain(proposalTitlePrefix);
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    const randomIndex = Math.floor(Math.random() * choices.length);
    const choiceToSelect = choices[randomIndex];
    const choiceIndexString = (randomIndex + 1).toString();
    const expectedChoiceValue = { [choiceIndexString]: 1 };
    console.log(
      `${testLogPrefix} Randomly selected choice: "${choiceToSelect}" (Index: ${randomIndex}, Expected API Value: ${JSON.stringify(expectedChoiceValue)})`
    );

    const choiceRadioButton = frame
      .locator('div[role="dialog"]')
      .getByRole('radio', { name: choiceToSelect });
    await expect(
      choiceRadioButton,
      `${testLogPrefix} Choice radio button should be visible`
    ).toBeVisible({ timeout: 10000 });
    await choiceRadioButton.check();

    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await frame
      .locator('textarea#reason')
      .fill(uniqueReasonNonce, { timeout: 1000 });

    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
  });

  test('[Ranked-Choice] should use active or create proposal, vote with random order via UI, verify via API', async ({
    context,
    page,
    metamaskPage,
    extensionId,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    const testLogPrefix = '[Ranked-Choice]';
    const voteType = 'ranked-choice';
    const choices = ['Rank C A', 'Rank C B', 'Rank C C', 'Rank C D'];
    const proposalTitlePrefix = 'E2E Test Proposal (Ranked Choice)';
    const proposalBody = 'Automated test proposal for ranked-choice voting.';
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    const proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:6006/?path=/story/vote-button--snapshot-ranked-choice&viewMode=story&nav=false&panel=false&toolbar=false`
    );
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    console.log(`${testLogPrefix} Voting via UI...`);
    const frame = await getStorybookFrame(page, testLogPrefix);

    const voteButton = frame.getByRole('button', { name: 'Cast Your Vote' });
    await expect(
      voteButton,
      `${testLogPrefix} Cast Your Vote button should be visible`
    ).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const dialogLocator = frame.locator('div[role="dialog"]');
    await expect(
      dialogLocator,
      `${testLogPrefix} Vote modal dialog should be visible`
    ).toBeVisible({ timeout: 10000 });
    const proposalTitleLocator = dialogLocator.locator('h2');
    await expect(
      proposalTitleLocator,
      `${testLogPrefix} Modal title should contain proposal title prefix`
    ).toContainText(proposalTitlePrefix, {
      timeout: 10000,
    });
    console.log(`${testLogPrefix} Modal opened and title verified.`);

    const numChoices = choices.length;
    const originalIndices = Array.from({ length: numChoices }, (_, i) => i);
    const targetOrder = shuffleArray([...originalIndices]);

    console.log(
      `${testLogPrefix} Original order indices: ${JSON.stringify(originalIndices.map((i) => i + 1))}`
    );
    console.log(
      `${testLogPrefix} Target random order indices: ${JSON.stringify(targetOrder.map((i) => i + 1))}`
    );

    let currentOrder = [...originalIndices];
    const dragOperations: Array<{
      fromIndex: number;
      toIndex: number;
      item: string;
    }> = [];
    let expectedFinalOrder: number[] = [];

    for (let targetPos = 0; targetPos < numChoices; targetPos++) {
      const targetValue = targetOrder[targetPos];
      const currentPos = currentOrder.indexOf(targetValue);

      if (currentPos !== targetPos) {
        dragOperations.push({
          fromIndex: currentPos,
          toIndex: targetPos,
          item: choices[targetValue],
        });
        currentOrder = [
          ...currentOrder.slice(0, currentPos),
          ...currentOrder.slice(currentPos + 1),
        ];
        currentOrder = [
          ...currentOrder.slice(0, targetPos),
          targetValue,
          ...currentOrder.slice(targetPos),
        ];
      }
    }

    expectedFinalOrder = currentOrder.map((originalIndex) => originalIndex + 1);

    console.log(
      `${testLogPrefix} Performing ${dragOperations.length} drag operations`
    );
    console.log(
      `${testLogPrefix} Expected final order (1-based): ${JSON.stringify(expectedFinalOrder)}`
    );

    const sortableItemContainerSelector =
      'div[role="dialog"] div.flex.items-center.space-x-2.rounded.border.p-2';
    const getDragHandleLocator = (itemContainerLocator: Locator): Locator =>
      itemContainerLocator.locator('button[aria-label^="Drag"]');
    const getItemContainerByIndex = (index: number): Locator =>
      frame.locator(sortableItemContainerSelector).nth(index);

    await expect(
      frame.locator(sortableItemContainerSelector).first(),
      `${testLogPrefix} Ranked choice items should be visible`
    ).toBeVisible({ timeout: 15000 });
    await expect(
      frame.locator(sortableItemContainerSelector),
      `${testLogPrefix} Number of ranked choice items should match choices count`
    ).toHaveCount(choices.length, { timeout: 10000 });

    await page.waitForTimeout(1000);

    const getItemText = async (container: Locator): Promise<string> => {
      const textSpan = container
        .locator('span')
        .filter({ hasText: /^(?!Move item|.*\d+\.$)/ });
      return ((await textSpan.textContent()) || '').trim();
    };

    for (const [opIndex, op] of dragOperations.entries()) {
      try {
        console.log(
          `${testLogPrefix} Drag operation ${opIndex + 1}/${dragOperations.length}: Moving item "${op.item}" from position ${op.fromIndex + 1} to ${op.toIndex + 1}`
        );

        const sourceContainer = getItemContainerByIndex(op.fromIndex);
        const targetContainer = getItemContainerByIndex(op.toIndex);

        const sourceText = await getItemText(sourceContainer);
        const targetText = await getItemText(targetContainer);

        console.log(
          `${testLogPrefix} Found source: "${sourceText}", target: "${targetText}"`
        );

        const sourceHandle = getDragHandleLocator(sourceContainer);
        await expect(
          sourceHandle,
          `${testLogPrefix} Drag handle for item "${op.item}" should be visible`
        ).toBeVisible({ timeout: 5000 });

        let dragSucceeded = false;

        try {
          console.log(
            `${testLogPrefix} Attempting keyboard-based drag for operation ${opIndex + 1}...`
          );
          await sourceHandle.click();
          await page.waitForTimeout(500);
          await page.keyboard.press('Space');
          await page.waitForTimeout(800);

          const direction = op.toIndex > op.fromIndex ? 'ArrowDown' : 'ArrowUp';
          const keyPresses = Math.abs(op.toIndex - op.fromIndex);

          for (let i = 0; i < keyPresses; i++) {
            await page.keyboard.press(direction);
            await page.waitForTimeout(300);
          }

          await page.keyboard.press('Space');
          await page.waitForTimeout(1000);

          const newSourceText = await getItemText(
            getItemContainerByIndex(op.toIndex)
          );
          console.log(
            `${testLogPrefix} After keyboard drag, item at position ${op.toIndex + 1}: "${newSourceText}"`
          );

          dragSucceeded = true;
          console.log(
            `${testLogPrefix} Keyboard drag succeeded for operation ${opIndex + 1}`
          );
        } catch (keyboardError) {
          console.log(
            `${testLogPrefix} Keyboard drag failed, falling back to mouse drag: ${keyboardError}`
          );
        }

        if (!dragSucceeded) {
          console.log(
            `${testLogPrefix} Attempting mouse-based drag for operation ${opIndex + 1}...`
          );

          const updatedSourceContainer = getItemContainerByIndex(op.fromIndex);
          const updatedTargetContainer = getItemContainerByIndex(op.toIndex);
          const updatedSourceHandle = getDragHandleLocator(
            updatedSourceContainer
          );

          const sourceBox = await updatedSourceHandle.boundingBox();
          const targetBox = await updatedTargetContainer.boundingBox();

          if (!sourceBox || !targetBox) {
            throw new Error(
              `Could not get bounding box for drag elements in operation ${opIndex + 1}`
            );
          }

          const sourceCenter = {
            x: sourceBox.x + sourceBox.width / 2,
            y: sourceBox.y + sourceBox.height / 2,
          };

          const verticalOffset =
            op.toIndex > op.fromIndex
              ? targetBox.height * 0.7
              : targetBox.height * 0.3;
          const targetPoint = {
            x: targetBox.x + targetBox.width / 2,
            y: targetBox.y + verticalOffset,
          };

          await updatedSourceHandle.hover({ force: true });
          await page.waitForTimeout(300);
          await page.mouse.down();
          await page.waitForTimeout(500);

          const steps = 20;
          for (let i = 1; i <= steps; i++) {
            const moveX =
              sourceCenter.x + (targetPoint.x - sourceCenter.x) * (i / steps);
            const moveY =
              sourceCenter.y + (targetPoint.y - sourceCenter.y) * (i / steps);
            await page.mouse.move(moveX, moveY, { steps: 5 });
            await page.waitForTimeout(50);
          }

          await page.mouse.move(targetPoint.x, targetPoint.y);
          await page.waitForTimeout(500);
          await page.mouse.up();
          await page.waitForTimeout(1000);

          try {
            const newItemText = await getItemText(
              getItemContainerByIndex(op.toIndex)
            );
            console.log(
              `${testLogPrefix} After mouse drag, item at position ${op.toIndex + 1}: "${newItemText}"`
            );
          } catch (verifyError) {
            console.log(
              `${testLogPrefix} Warning: Could not verify item position after drag: ${verifyError}`
            );
          }
        }

        await page.waitForTimeout(1000);
      } catch (dragError) {
        console.error(
          `${testLogPrefix} Error in drag operation ${opIndex + 1}: ${dragError}`
        );
        console.log(`${testLogPrefix} Continuing with next operation...`);

        try {
          const screenshotPath = `./ranked-choice-drag-error-${Date.now()}.png`;
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(
            `${testLogPrefix} Saved error screenshot to ${screenshotPath}`
          );
        } catch (ssError) {
          console.log(
            `${testLogPrefix} Failed to take error screenshot: ${ssError}`
          );
        }
      }
    }

    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    const reasonTextArea = dialogLocator.locator('textarea#reason');
    await expect(
      reasonTextArea,
      `${testLogPrefix} Reason textarea should be visible in modal`
    ).toBeVisible({ timeout: 10000 });
    await reasonTextArea.fill(uniqueReasonNonce);

    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    console.log(
      `${testLogPrefix} Verifying vote via API with expected order: ${JSON.stringify(expectedFinalOrder)}`
    );
    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedFinalOrder,
      expectedReasonString,
      testLogPrefix
    );
  });

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
    const uniqueReasonNonce = `test-run-${Date.now()}`;
    const expectedReasonString = `${uniqueReasonNonce}\n${ATTRIBUTION_TEXT}`;

    const proposalId = await getOrCreateActiveProposal(
      voteType,
      proposalTitlePrefix,
      proposalBody,
      choices,
      testLogPrefix
    );

    const metamask = new MetaMask(
      context,
      metamaskPage,
      basicSetup.walletPassword,
      extensionId
    );
    await page.goto(
      `http://localhost:6006/?path=/story/vote-button--snapshot-weighted&viewMode=story&nav=false&panel=false&toolbar=false`
    );
    await connectWallet(page, metamask, metamaskPage, testLogPrefix);

    console.log(`${testLogPrefix} Voting via UI...`);
    const frame = await getStorybookFrame(page, testLogPrefix);

    const voteButton = frame.getByRole('button', { name: 'Cast Your Vote' });
    await expect(
      voteButton,
      `${testLogPrefix} Cast Your Vote button should be visible`
    ).toBeVisible({ timeout: 30000 });
    await voteButton.click();

    const proposalTitle = await frame
      .locator('.sm\\:max-w-\\[525px\\] h2')
      .textContent();
    expect(
      proposalTitle,
      `${testLogPrefix} Modal title should contain proposal title prefix`
    ).toContain(proposalTitlePrefix);
    console.log(`${testLogPrefix} Modal title verified: "${proposalTitle}"`);

    const weights = generateWeights(choices.length, 100);
    const expectedChoiceValue: { [key: string]: number } = {};

    console.log(`${testLogPrefix} Generated random weights: ${weights}`);

    const dialogLocator = frame.locator('div[role="dialog"]');

    for (let i = 0; i < choices.length; i++) {
      const choiceText = choices[i];
      const weight = weights[i];
      const choiceIndexString = (i + 1).toString();

      console.log(
        `${testLogPrefix} Setting weight for "${choiceText}" (Index: ${i}) to ${weight}%`
      );

      const weightInput = dialogLocator
        .locator(`label:has-text("${choiceText}")`)
        .locator('..')
        .getByRole('spinbutton');

      await expect(
        weightInput,
        `${testLogPrefix} Weight input for "${choiceText}" should be visible`
      ).toBeVisible({ timeout: 10000 });
      await weightInput.fill(weight.toString());

      expectedChoiceValue[choiceIndexString] = weight;
    }

    console.log(
      `${testLogPrefix} Expected API choice value: ${JSON.stringify(expectedChoiceValue)}`
    );

    await expect(
      dialogLocator.getByText('100%', { exact: true }),
      `${testLogPrefix} Total weight should be 100%`
    ).toBeVisible({
      timeout: 5000,
    });

    console.log(
      `${testLogPrefix} Filling reason with nonce: "${uniqueReasonNonce}"`
    );
    await frame
      .locator('textarea#reason')
      .fill(uniqueReasonNonce, { timeout: 1000 });

    await submitVoteAndConfirmMetamask(
      page,
      metamaskPage,
      metamask,
      testLogPrefix,
      API_VERIFICATION_DELAY
    );

    await verifyVoteViaApi(
      proposalId,
      await metamask.getAccountAddress(),
      expectedChoiceValue,
      expectedReasonString,
      testLogPrefix
    );
  });
});
