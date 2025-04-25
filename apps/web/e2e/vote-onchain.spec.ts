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
  decodeEventLog,
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
    const delegatorBalance = await testClient.readContract({
      address: ARBITRUM_TOKEN_ADDRESS,
      abi: ARBITRUM_TOKEN_ABI,
      functionName: 'balanceOf',
      args: [DELEGATOR_ACCOUNT],
    });
    console.log(
      `Delegator ${DELEGATOR_ACCOUNT} token balance: ${delegatorBalance}`
    );
    // Note: If balance is 0, delegation won't have power, but the tx should still succeed.
    // Add logic here to mint/transfer tokens if needed for the test scenario.

    console.log(
      `Delegating from ${DELEGATOR_ACCOUNT} to ${DELEGATE_ACCOUNT}...`
    );
    // Delegate transaction requires gas, ensure DELEGATOR_ACCOUNT has funds (funded above)
    const delegateTxHash = await testClient.writeContract({
      address: ARBITRUM_TOKEN_ADDRESS,
      abi: ARBITRUM_TOKEN_ABI,
      functionName: 'delegate',
      args: [DELEGATE_ACCOUNT],
      account: DELEGATOR_ACCOUNT, // Impersonated account sending the transaction
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

    const proposeTxHash = await testClient.writeContract({
      address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
      abi: ARBITRUM_CORE_GOVERNOR_ABI,
      functionName: 'propose',
      args: [targets, values, calldatas, description],
      account: DELEGATE_ACCOUNT, // Impersonated account creating proposal
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

    // --- Updated Proposal ID Extraction ---
    const proposalCreatedEventSignature =
      'ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)';
    const proposalCreatedEventTopic = getEventSelector(
      proposalCreatedEventSignature
    );

    // Find the log entry for the ProposalCreated event
    const proposalCreatedEventLog = proposeReceipt.logs.find(
      (log) =>
        log.address.toLowerCase() ===
          ARBITRUM_CORE_GOVERNOR_ADDRESS.toLowerCase() &&
        log.topics[0] === proposalCreatedEventTopic
    );

    let proposalId: bigint | undefined;

    if (proposalCreatedEventLog) {
      try {
        // Decode the event log using the ABI, data, and topics
        const decodedEvent = decodeEventLog({
          abi: ARBITRUM_CORE_GOVERNOR_ABI,
          eventName: 'ProposalCreated', // Explicitly stating event name
          data: proposalCreatedEventLog.data as `0x${string}`,
          // Cast topics for decodeEventLog - it expects specific types
          topics: proposalCreatedEventLog.topics as [
            signature: `0x${string}`,
            ...args: `0x${string}`[],
          ],
        });

        // Access the proposalId from the decoded arguments object
        // Check if args exists and has the proposalId property
        if (decodedEvent.args && 'proposalId' in decodedEvent.args) {
          const idFromArgs = decodedEvent.args.proposalId;
          // Verify the type is bigint before assigning
          if (typeof idFromArgs === 'bigint') {
            proposalId = idFromArgs;
            console.log(`Successfully decoded Proposal ID: ${proposalId}`);
          } else {
            console.error(
              `Decoded proposalId is not of type bigint. Found type: ${typeof idFromArgs}`,
              idFromArgs
            );
          }
        } else {
          console.error(
            'Could not find proposalId in decoded event arguments:',
            decodedEvent.args
          );
        }
      } catch (e) {
        console.error('Failed to decode ProposalCreated event log:', e);
        console.error('Log data:', proposalCreatedEventLog.data);
        console.error('Log topics:', proposalCreatedEventLog.topics);
      }
    } else {
      // Log a more detailed warning if the event log itself isn't found
      console.warn(
        `Could not find ProposalCreated event log with topic ${proposalCreatedEventTopic} in transaction ${proposeTxHash}. Governor address: ${ARBITRUM_CORE_GOVERNOR_ADDRESS}. Available logs:`,
        proposeReceipt.logs.map((log) => ({
          address: log.address,
          topics: log.topics,
        }))
      );
    }
    // --- End of Updated Proposal ID Extraction ---

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
        `Proposal state for ID ${proposalId} should be Pending (0) after creation`
      ).toBe(0); // Enum: 0: Pending
      console.log(
        `Verified: Proposal ${proposalId} state is Pending (0) after creation.`
      );
    } else {
      // Fail the test explicitly if proposalId is crucial for subsequent steps
      test.fail(
        proposalId == undefined,
        'Proposal ID could not be extracted, cannot proceed with state checks.'
      );
      // Alternatively, keep as warning if the test structure allows:
      // console.warn('Cannot check state after creation: proposalId not found.');
    }

    await testClient.stopImpersonatingAccount({ address: DELEGATE_ACCOUNT });
    console.log(`Stopped impersonating ${DELEGATE_ACCOUNT}`);

    // Ensure proposalId was found before proceeding
    if (proposalId === undefined) {
      // This case should already be handled by test.fail above, but being defensive
      throw new Error('Cannot proceed without a valid proposalId.');
    }

    // 5. Mine blocks to pass voting delay
    console.log('Mining blocks to pass voting delay...');
    const votingDelay = await testClient.readContract({
      address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
      abi: ARBITRUM_CORE_GOVERNOR_ABI,
      functionName: 'votingDelay',
      args: [],
    });
    // Ensure votingDelay is treated as a number for calculation
    const blocksToMine = Number(votingDelay) + 1; // Add 1 to ensure delay is passed
    console.log(
      `Voting delay is ${votingDelay} blocks. Mining ${blocksToMine} blocks...`
    );

    // Mine blocks in chunks to avoid potential timeouts/issues with large numbers
    const CHUNK_SIZE = 1000; // Mine 1000 blocks at a time
    let remainingBlocks = blocksToMine;
    let minedSoFar = 0;
    while (remainingBlocks > 0) {
      const blocksInThisChunk = Math.min(CHUNK_SIZE, remainingBlocks);
      console.log(
        `Mining chunk of ${blocksInThisChunk} blocks (${minedSoFar + blocksInThisChunk}/${blocksToMine})...`
      );
      await testClient.mine({ blocks: blocksInThisChunk });
      remainingBlocks -= blocksInThisChunk;
      minedSoFar += blocksInThisChunk;
    }

    console.log(`Finished mining ${blocksToMine} blocks.`);

    // 6. Verify Proposal State after Voting Delay (should be Active)
    // We already checked proposalId is defined before this block
    const proposalStateAfterDelay = await testClient.readContract({
      address: ARBITRUM_CORE_GOVERNOR_ADDRESS,
      abi: ARBITRUM_CORE_GOVERNOR_ABI,
      functionName: 'state',
      args: [proposalId], // proposalId is guaranteed to be defined here
    });
    expect(
      proposalStateAfterDelay,
      `Proposal state for ID ${proposalId} should be Active (1) after voting delay`
    ).toBe(1); // Enum: 1: Active
    console.log(
      `Verified: Proposal ${proposalId} state is Active (1) after voting delay.`
    );

    // Next steps would involve casting votes and proceeding through proposal lifecycle
  });
});
