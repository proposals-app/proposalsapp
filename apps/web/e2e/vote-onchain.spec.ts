// proposalsapp/apps/web/e2e/vote-onchain.spec.ts
import { testWithSynpress } from '@synthetixio/synpress';
import { metaMaskFixtures } from '@synthetixio/synpress/playwright';
import basicSetup from './wallet-setup/basic.setup';
import {
  type Chain,
  createTestClient,
  http,
  publicActions,
  walletActions,
  type Address,
  parseEther,
  encodeFunctionData,
} from 'viem';
import { arbitrum } from 'viem/chains';

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

// --- Constants ---
const TEST_NODE_URL = 'http://localhost:8545';
const TEST_NODE_WS_URL = 'ws://localhost:8545';
const PROPOSER_ACCOUNT: Address = '0x1B686eE8E31c5959D9F5BBd8122a58682788eeaD'; // Account that creates the proposal
const DELEGATE_ACCOUNT: Address = '0x36f5dfa2D6cc313C5e984d22A8Ee4c12B905bCb8'; // Account receiving the delegated votes
const DELEGATOR_ACCOUNT: Address = '0x1B686eE8E31c5959D9F5BBd8122a58682788eeaD'; // Account that owns tokens and delegates

const TOKEN_CONTRACT_ADDRESS: Address =
  '0x912CE59144191C1204E64559FE8253a0e49E6548';
const GOVERNOR_CONTRACT_ADDRESS: Address =
  '0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9';

// --- Contract ABIs ---
// NOTE: Using partial ABIs for brevity and focus
const GOVERNOR_ABI = [
  {
    inputs: [],
    name: 'votingDelay',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'targets', type: 'address[]' },
      { internalType: 'uint256[]', name: 'values', type: 'uint256[]' },
      { internalType: 'bytes[]', name: 'calldatas', type: 'bytes[]' },
      { internalType: 'string', name: 'description', type: 'string' },
    ],
    name: 'propose',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'newVotingDelay', type: 'uint256' },
    ],
    name: 'setVotingDelay',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const TOKEN_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'delegatee', type: 'address' }],
    name: 'delegate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'delegates',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'getVotes',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Only including necessary functions for delegation and verification
] as const;

// --- Viem Test Client Setup ---
const testnode = {
  ...arbitrum,
  rpcUrls: {
    default: {
      http: [TEST_NODE_URL],
      webSocket: [TEST_NODE_WS_URL],
    },
    public: {
      http: [TEST_NODE_URL],
      webSocket: [TEST_NODE_WS_URL],
    },
  },
} as const satisfies Chain;

const testClient = createTestClient({
  chain: testnode,
  mode: 'anvil',
  transport: http(),
})
  .extend(publicActions)
  .extend(walletActions);

// --- Test Suite ---
test.describe.serial('Onchain Voting E2E Tests', () => {
  test('can delegate votes and create a proposal', async ({
    page, // Keep page fixture even if not directly used for Synpress setup
  }) => {
    // 1. Setup Test Node State
    await testClient.setAutomine(true);
    await testClient.setIntervalMining({ interval: 1 });
    await page.waitForTimeout(1000); // Short pause for node setup stabilization

    // 2. Delegate Voting Power
    console.log(
      `Setting up delegation from ${DELEGATOR_ACCOUNT} to ${DELEGATE_ACCOUNT}`
    );
    await testClient.setBalance({
      address: DELEGATOR_ACCOUNT,
      value: parseEther('10'),
    });
    await testClient.setBalance({
      address: DELEGATE_ACCOUNT,
      value: parseEther('10'),
    });
    await testClient.setBalance({
      address: PROPOSER_ACCOUNT,
      value: parseEther('10'),
    });

    await testClient.impersonateAccount({ address: DELEGATOR_ACCOUNT });

    const delegatorBalance = await testClient.readContract({
      address: TOKEN_CONTRACT_ADDRESS,
      abi: TOKEN_ABI,
      functionName: 'balanceOf',
      args: [DELEGATOR_ACCOUNT],
    });
    console.log(
      `Delegator ${DELEGATOR_ACCOUNT} token balance: ${delegatorBalance}`
    );

    console.log(
      `Delegating from ${DELEGATOR_ACCOUNT} to ${DELEGATE_ACCOUNT}...`
    );
    const delegateTxHash = await testClient.writeContract({
      address: TOKEN_CONTRACT_ADDRESS,
      abi: TOKEN_ABI,
      functionName: 'delegate',
      args: [DELEGATE_ACCOUNT],
      account: DELEGATOR_ACCOUNT, // Impersonated delegator sends the transaction
    });

    console.log(`Delegation transaction hash: ${delegateTxHash}`);
    const delegateReceipt = await testClient.waitForTransactionReceipt({
      hash: delegateTxHash,
      timeout: 15000,
    });
    expect(
      delegateReceipt.status,
      'Delegation transaction should succeed'
    ).toBe('success');
    console.log(`Delegation successful. Tx: ${delegateTxHash}`);

    // Verify delegation took effect (optional but recommended)
    const currentDelegate = await testClient.readContract({
      address: TOKEN_CONTRACT_ADDRESS,
      abi: TOKEN_ABI,
      functionName: 'delegates',
      args: [DELEGATOR_ACCOUNT],
    });
    expect(
      currentDelegate,
      'Delegation should be set to the DELEGATE_ACCOUNT'
    ).toBe(DELEGATE_ACCOUNT);
    console.log(
      `Verified: ${DELEGATOR_ACCOUNT} now delegates to ${currentDelegate}`
    );

    await testClient.stopImpersonatingAccount({ address: DELEGATOR_ACCOUNT });
    console.log(`Stopped impersonating ${DELEGATOR_ACCOUNT}`);

    // 3. Create the Proposal using the Proposer Account
    console.log(`Setting up proposal creation by ${PROPOSER_ACCOUNT}`);
    await testClient.impersonateAccount({ address: PROPOSER_ACCOUNT });

    // Define Proposal Parameters (Example: setting voting delay)
    const currentVotingDelay = await testClient.readContract({
      address: GOVERNOR_CONTRACT_ADDRESS,
      abi: GOVERNOR_ABI,
      functionName: 'votingDelay',
    });
    console.log(`Current voting delay: ${currentVotingDelay}`);

    const targets: Address[] = [GOVERNOR_CONTRACT_ADDRESS];
    const values: bigint[] = [BigInt(0)];
    const calldatas: `0x${string}`[] = [
      encodeFunctionData({
        abi: GOVERNOR_ABI,
        functionName: 'setVotingDelay',
        args: [currentVotingDelay], // Propose setting it to the current value (no-op example)
      }),
    ];
    const description = `E2E Test Proposal - ${new Date().toISOString()}`;

    // Create the Proposal via writeContract
    console.log(`Creating proposal on contract: ${GOVERNOR_CONTRACT_ADDRESS}`);
    console.log(`Proposal details: description="${description}"`);

    const proposeTxHash = await testClient.writeContract({
      address: GOVERNOR_CONTRACT_ADDRESS,
      abi: GOVERNOR_ABI,
      functionName: 'propose',
      args: [targets, values, calldatas, description],
      account: PROPOSER_ACCOUNT, // The impersonated proposer sends the transaction
    });

    console.log(`Proposal transaction hash: ${proposeTxHash}`);
    expect(
      proposeTxHash,
      'Transaction hash should be a valid hex string'
    ).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // Verify Proposal Transaction Success
    console.log(`Waiting for transaction receipt for ${proposeTxHash}...`);
    const proposeReceipt = await testClient.waitForTransactionReceipt({
      hash: proposeTxHash,
      timeout: 15000,
    });

    console.log(
      `Proposal transaction receipt status: ${proposeReceipt.status}`
    );
    expect(proposeReceipt.status, 'Proposal transaction should succeed').toBe(
      'success'
    );

    // Cleanup impersonation
    await testClient.stopImpersonatingAccount({ address: PROPOSER_ACCOUNT });
    console.log(`Stopped impersonating ${PROPOSER_ACCOUNT}`);
  });
});
