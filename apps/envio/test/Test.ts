import assert from "assert";
import { 
  TestHelpers,
  TransparentUpgradeableProxy_ProposalCanceled
} from "generated";
const { MockDb, TransparentUpgradeableProxy } = TestHelpers;

describe("TransparentUpgradeableProxy contract ProposalCanceled event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for TransparentUpgradeableProxy contract ProposalCanceled event
  const event = TransparentUpgradeableProxy.ProposalCanceled.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("TransparentUpgradeableProxy_ProposalCanceled is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await TransparentUpgradeableProxy.ProposalCanceled.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualTransparentUpgradeableProxyProposalCanceled = mockDbUpdated.entities.TransparentUpgradeableProxy_ProposalCanceled.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedTransparentUpgradeableProxyProposalCanceled: TransparentUpgradeableProxy_ProposalCanceled = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      proposalId: event.params.proposalId,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualTransparentUpgradeableProxyProposalCanceled, expectedTransparentUpgradeableProxyProposalCanceled, "Actual TransparentUpgradeableProxyProposalCanceled should be the same as the expectedTransparentUpgradeableProxyProposalCanceled");
  });
});
