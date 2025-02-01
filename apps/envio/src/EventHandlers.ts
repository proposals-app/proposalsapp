/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  TransparentUpgradeableProxy,
  TransparentUpgradeableProxy_ProposalCanceled,
  TransparentUpgradeableProxy_ProposalCreated,
  TransparentUpgradeableProxy_ProposalExecuted,
  TransparentUpgradeableProxy_ProposalExtended,
  TransparentUpgradeableProxy_ProposalQueued,
  TransparentUpgradeableProxy_VoteCast,
  TransparentUpgradeableProxy_VoteCastWithParams,
} from "generated";

TransparentUpgradeableProxy.ProposalCanceled.handler(async ({ event, context }) => {
  const entity: TransparentUpgradeableProxy_ProposalCanceled = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    proposalId: event.params.proposalId,
  };

  context.TransparentUpgradeableProxy_ProposalCanceled.set(entity);
});

TransparentUpgradeableProxy.ProposalCreated.handler(async ({ event, context }) => {
  const entity: TransparentUpgradeableProxy_ProposalCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    proposalId: event.params.proposalId,
    proposer: event.params.proposer,
    targets: event.params.targets,
    values: event.params.values,
    signatures: event.params.signatures,
    calldatas: event.params.calldatas,
    startBlock: event.params.startBlock,
    endBlock: event.params.endBlock,
    description: event.params.description,
  };

  context.TransparentUpgradeableProxy_ProposalCreated.set(entity);
});

TransparentUpgradeableProxy.ProposalExecuted.handler(async ({ event, context }) => {
  const entity: TransparentUpgradeableProxy_ProposalExecuted = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    proposalId: event.params.proposalId,
  };

  context.TransparentUpgradeableProxy_ProposalExecuted.set(entity);
});

TransparentUpgradeableProxy.ProposalExtended.handler(async ({ event, context }) => {
  const entity: TransparentUpgradeableProxy_ProposalExtended = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    proposalId: event.params.proposalId,
    extendedDeadline: event.params.extendedDeadline,
  };

  context.TransparentUpgradeableProxy_ProposalExtended.set(entity);
});

TransparentUpgradeableProxy.ProposalQueued.handler(async ({ event, context }) => {
  const entity: TransparentUpgradeableProxy_ProposalQueued = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    proposalId: event.params.proposalId,
    eta: event.params.eta,
  };

  context.TransparentUpgradeableProxy_ProposalQueued.set(entity);
});

TransparentUpgradeableProxy.VoteCast.handler(async ({ event, context }) => {
  const entity: TransparentUpgradeableProxy_VoteCast = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    voter: event.params.voter,
    proposalId: event.params.proposalId,
    support: event.params.support,
    weight: event.params.weight,
    reason: event.params.reason,
  };

  context.TransparentUpgradeableProxy_VoteCast.set(entity);
});

TransparentUpgradeableProxy.VoteCastWithParams.handler(async ({ event, context }) => {
  const entity: TransparentUpgradeableProxy_VoteCastWithParams = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    voter: event.params.voter,
    proposalId: event.params.proposalId,
    support: event.params.support,
    weight: event.params.weight,
    reason: event.params.reason,
    params: event.params.params,
  };

  context.TransparentUpgradeableProxy_VoteCastWithParams.set(entity);
});
