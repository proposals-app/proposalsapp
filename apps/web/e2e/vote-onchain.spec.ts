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
  getEventSelector,
} from 'viem';
import { arbitrum } from 'viem/chains';
import { ARBITRUM_TOKEN_ABI, ARBITRUM_TOKEN_ADDRESS } from '@/lib/constants';
import {
  ARBITRUM_CORE_GOVERNOR_ADDRESS,
  ARBITRUM_CORE_GOVERNOR_ABI,
} from '@/lib/constants';

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

// --- Constants ---
const TEST_NODE_URL = 'http://localhost:8545';
const TEST_NODE_WS_URL = 'ws://localhost:8545';
const DELEGATE_ACCOUNT: Address = '0x36f5dfa2D6cc313C5e984d22A8Ee4c12B905bCb8';
const DELEGATOR_ACCOUNT: Address = '0xeaFF9F354063395fcd141BE8A82f73b311725EEA';

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
    test.setTimeout(0);
    // 1. Setup Test Node State
    await testClient.setAutomine(true);
    await testClient.setIntervalMining({ interval: 1 });
    await page.waitForTimeout(1000); // Short pause for node setup stabilization

    // 2. Fund Accounts (initial funding)
    console.log(`Funding accounts initially...`);
    await testClient.setBalance({
      address: DELEGATOR_ACCOUNT,
      value: parseEther('100'),
    });
    await testClient.setBalance({
      address: DELEGATE_ACCOUNT,
      value: parseEther('100'),
    });

    // Mine blocks to confirm initial state including funding
    await testClient.mine({ blocks: 1 }); // One block should be enough to confirm balances

    expect(
      await testClient.getBalance({
        address: DELEGATOR_ACCOUNT,
      }),
      `Delegator balance should be 100 ETH`
    ).toBe(parseEther('100'));

    expect(
      await testClient.getBalance({
        address: DELEGATE_ACCOUNT,
      }),
      `Delegate balance should be 100 ETH`
    ).toBe(parseEther('100'));

    console.log('Initial accounts funded.');

    // 3. Delegate Voting Power (from DELEGATOR_ACCOUNT to DELEGATE_ACCOUNT)
    console.log(
      `Setting up delegation from ${DELEGATOR_ACCOUNT} to ${DELEGATE_ACCOUNT}`
    );
    await testClient.impersonateAccount({ address: DELEGATOR_ACCOUNT });

    await testClient.sendTransaction({
      to: DELEGATE_ACCOUNT,
      value: parseEther('1'),
      account: DELEGATOR_ACCOUNT,
    });

    await testClient.mine({ blocks: 1 });

    expect(
      await testClient.getBalance({
        address: DELEGATOR_ACCOUNT,
      }),
      `Delegator balance should > 98 ETH`
    ).toBeGreaterThan(parseEther('98'));

    expect(
      await testClient.getBalance({
        address: DELEGATOR_ACCOUNT,
      }),
      `Delegator balance should < 98 ETH`
    ).toBeLessThan(parseEther('99'));

    expect(
      await testClient.getBalance({
        address: DELEGATE_ACCOUNT,
      }),
      `Delegate balance should be 101 ETH`
    ).toBeGreaterThan(parseEther('100'));

    const delegatorBalance = await testClient.readContract({
      address: ARBITRUM_TOKEN_ADDRESS,
      abi: ARBITRUM_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [DELEGATOR_ACCOUNT],
    });
    console.log(
      `Delegator ${DELEGATOR_ACCOUNT} token balance: ${delegatorBalance}`
    );

    console.log(
      `Delegating from ${DELEGATOR_ACCOUNT} to ${DELEGATE_ACCOUNT}...`
    );
    // Delegate transaction requires gas, ensure DELEGATOR_ACCOUNT has funds (funded above)
    const delegateTxHash = await testClient.writeContract({
      address: ARBITRUM_TOKEN_ADDRESS,
      abi: ARBITRUM_TOKEN_ABI,
      functionName: 'delegate',
      args: [DELEGATE_ACCOUNT],
      account: DELEGATOR_ACCOUNT,
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

    // Verify delegation took effect
    const currentDelegate = await testClient.readContract({
      address: ARBITRUM_TOKEN_ADDRESS,
      abi: ARBITRUM_TOKEN_ABI,
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

    // 4. Create a Proposal (by DELEGATE_ACCOUNT, acting as the proposer)
    // Proposer account was already funded sufficiently earlier
    console.log(`Impersonating ${DELEGATE_ACCOUNT} to create proposal...`);
    await testClient.impersonateAccount({ address: DELEGATE_ACCOUNT });

    const targets: Address[] = [ARBITRUM_CORE_GOVERNOR_ADDRESS]; // Example target
    const values: bigint[] = [BigInt(0)]; // Example value
    const calldatas: `0x${string}`[] = ['0x']; // Example calldata (empty)
    const description = `E2E Test Proposal - ${new Date().toISOString()}`;

    // Create the Proposal via writeContract
    console.log(
      `Creating proposal on contract: ${ARBITRUM_CORE_GOVERNOR_ADDRESS}`
    );
    console.log(`Proposal details: description="${description}"`);

    // Estimate gas cost for the proposal
    console.log(`Estimating gas cost for proposal creation...`);
    const estimatedGas = await testClient.estimateContractGas({
      address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
      abi: ARBITRUM_CORE_GOVERNOR_ABI,
      functionName: 'propose',
      args: [targets, values, calldatas, description],
      account: DELEGATE_ACCOUNT, // Estimate gas from the perspective of the proposer
    });
    console.log(`Estimated gas cost for proposal: ${estimatedGas}`);

    const proposeTxHash = await testClient.writeContract({
      address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
      abi: ARBITRUM_CORE_GOVERNOR_ABI,
      functionName: 'propose',
      args: [targets, values, calldatas, description],
      account: DELEGATE_ACCOUNT,
    });

    console.log(`Proposal transaction hash: ${proposeTxHash}`);
    const proposeReceipt = await testClient.waitForTransactionReceipt({
      hash: proposeTxHash,
      timeout: 15000, // Adjust if needed
    });

    expect(proposeReceipt.status, 'Proposal transaction should succeed').toBe(
      'success'
    );
    console.log(`Proposal successful. Tx: ${proposeTxHash}`);

    // Extract proposal ID from logs
    const proposalCreatedEvent = proposeReceipt.logs.find(
      (log: any) =>
        log.address.toLowerCase() ===
          ARBITRUM_CORE_GOVERNOR_ADDRESS.toLowerCase() &&
        log.topics[0] ===
          getEventSelector(
            'ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)'
          )
    );

    let proposalId: bigint | undefined;
    if (proposalCreatedEvent && proposalCreatedEvent.topics[1]) {
      // The proposalId is the first indexed topic (topics[1]) for this event signature
      try {
        proposalId = BigInt(proposalCreatedEvent.topics[1]);
        console.log(`Created Proposal ID: ${proposalId}`);
      } catch (e) {
        console.error(
          `Failed to parse proposalId from topic: ${proposalCreatedEvent.topics[1]}`,
          e
        );
      }
    } else {
      console.warn(
        `Could not find ProposalCreated event or proposalId topic in transaction logs for ${proposeTxHash}. Logs:`,
        proposeReceipt.logs
      );
    }

    // Verify the state of the proposal immediately after creation (should be Pending)
    if (proposalId !== undefined) {
      const proposalStateAfterCreation = await testClient.readContract({
        address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
        abi: ARBITRUM_CORE_GOVERNOR_ABI,
        functionName: 'state',
        args: [proposalId],
      });
      expect(
        proposalStateAfterCreation,
        'Proposal state should be Pending (0) after creation'
      ).toBe(0); // Enum: 0: Pending
      console.log(`Verified: Proposal state is Pending after creation.`);
    } else {
      console.warn('Cannot check state after creation: proposalId not found.');
    }

    await testClient.stopImpersonatingAccount({ address: DELEGATE_ACCOUNT });
    console.log(`Stopped impersonating ${DELEGATE_ACCOUNT}`);

    // 5. Mine blocks to pass voting delay
    console.log('Mining blocks to pass voting delay...');
    const votingDelay = await testClient.readContract({
      address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
      abi: ARBITRUM_CORE_GOVERNOR_ABI,
      functionName: 'votingDelay',
      args: [],
    });
    const blocksToMine = Number(votingDelay) + 1; // Add 1 to ensure delay is passed
    console.log(
      `Voting delay is ${votingDelay} blocks. Mining ${blocksToMine} blocks...`
    );

    // Mine blocks in chunks to avoid timeouts
    let remainingBlocks = blocksToMine;
    let minedSoFar = 0;
    while (remainingBlocks > 0) {
      const blocksInThisChunk = Math.min(1000, remainingBlocks);
      console.log(
        `Mining chunk of ${blocksInThisChunk} blocks (${minedSoFar + blocksInThisChunk}/${blocksToMine})...`
      );
      await testClient.mine({ blocks: blocksInThisChunk });
      remainingBlocks -= blocksInThisChunk;
      minedSoFar += blocksInThisChunk;
    }

    console.log('Finished mining blocks.');

    // 6. Verify Proposal State after Voting Delay (should be Active)
    if (proposalId !== undefined) {
      const proposalStateAfterDelay = await testClient.readContract({
        address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
        abi: ARBITRUM_CORE_GOVERNOR_ABI,
        functionName: 'state',
        args: [proposalId],
      });
      expect(
        proposalStateAfterDelay,
        'Proposal state should be Active (1) after voting delay'
      ).toBe(1); // Enum: 1: Active
      console.log(`Verified: Proposal state is Active after voting delay.`);
    } else {
      console.warn('Cannot check state after delay: proposalId not found.');
    }

    // Next steps would involve casting votes and proceeding through proposal lifecycle
  });
});
