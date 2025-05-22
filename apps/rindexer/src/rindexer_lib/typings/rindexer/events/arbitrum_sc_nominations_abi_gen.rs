use crate::rindexer_lib::typings::rindexer::events::arbitrum_sc_nominations_abi_gen::RindexerArbitrumSCNominationsGen::Date;
use alloy::sol;

sol!(
    #[derive(Debug)]
    #[sol(rpc, all_derives)]
    RindexerArbitrumSCNominationsGen,
    r#"[
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  {
    "inputs": [
      { "internalType": "enum Cohort", "name": "cohort", "type": "uint8" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "AccountInOtherCohort",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "contender", "type": "address" }
    ],
    "name": "AlreadyContender",
    "type": "error"
  },
  { "inputs": [], "name": "CastVoteDisabled", "type": "error" },
  {
    "inputs": [
      { "internalType": "uint256", "name": "nomineeCount", "type": "uint256" },
      { "internalType": "uint256", "name": "expectedCount", "type": "uint256" }
    ],
    "name": "CompliantNomineeTargetHit",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "blockTimestamp",
        "type": "uint256"
      },
      { "internalType": "uint256", "name": "startTime", "type": "uint256" }
    ],
    "name": "CreateTooEarly",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "message", "type": "string" }
    ],
    "name": "Deprecated",
    "type": "error"
  },
  { "inputs": [], "name": "Empty", "type": "error" },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "compliantNomineeCount",
        "type": "uint256"
      },
      { "internalType": "uint256", "name": "expectedCount", "type": "uint256" }
    ],
    "name": "InsufficientCompliantNomineeCount",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "votes", "type": "uint256" },
      { "internalType": "uint256", "name": "prevVotesUsed", "type": "uint256" },
      { "internalType": "uint256", "name": "weight", "type": "uint256" }
    ],
    "name": "InsufficientTokens",
    "type": "error"
  },
  { "inputs": [], "name": "InvalidSignature", "type": "error" },
  {
    "inputs": [
      { "internalType": "uint256", "name": "year", "type": "uint256" },
      { "internalType": "uint256", "name": "month", "type": "uint256" },
      { "internalType": "uint256", "name": "day", "type": "uint256" },
      { "internalType": "uint256", "name": "hour", "type": "uint256" }
    ],
    "name": "InvalidStartDate",
    "type": "error"
  },
  {
    "inputs": [{ "internalType": "uint8", "name": "support", "type": "uint8" }],
    "name": "InvalidSupport",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "prevProposalId", "type": "uint256" }
    ],
    "name": "LastMemberElectionNotExecuted",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "nominee", "type": "address" }
    ],
    "name": "NomineeAlreadyAdded",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "nominee", "type": "address" }
    ],
    "name": "NomineeAlreadyExcluded",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "NotAContract",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "contender", "type": "address" }
    ],
    "name": "NotEligibleContender",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "nominee", "type": "address" }
    ],
    "name": "NotNominee",
    "type": "error"
  },
  { "inputs": [], "name": "OnlyNomineeVetter", "type": "error" },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "nomineeProposalId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "memberProposalId",
        "type": "uint256"
      }
    ],
    "name": "ProposalIdMismatch",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
      {
        "internalType": "uint256",
        "name": "vettingDeadline",
        "type": "uint256"
      }
    ],
    "name": "ProposalInVettingPeriod",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
      {
        "internalType": "uint256",
        "name": "vettingDeadline",
        "type": "uint256"
      }
    ],
    "name": "ProposalNotInVettingPeriod",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "enum IGovernorUpgradeable.ProposalState",
        "name": "state",
        "type": "uint8"
      }
    ],
    "name": "ProposalNotPending",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "enum IGovernorUpgradeable.ProposalState",
        "name": "state",
        "type": "uint8"
      }
    ],
    "name": "ProposalNotSucceededState",
    "type": "error"
  },
  { "inputs": [], "name": "ProposeDisabled", "type": "error" },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "quorumNumeratorValue",
        "type": "uint256"
      }
    ],
    "name": "QuorumNumeratorTooLow",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "startTime", "type": "uint256" },
      { "internalType": "uint256", "name": "currentTime", "type": "uint256" }
    ],
    "name": "StartDateTooEarly",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "paramLength", "type": "uint256" }
    ],
    "name": "UnexpectedParamsLength",
    "type": "error"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "voter", "type": "address" },
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "bytes32", "name": "replayHash", "type": "bytes32" }
    ],
    "name": "VoteAlreadyCast",
    "type": "error"
  },
  { "inputs": [], "name": "ZeroAddress", "type": "error" },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "contender",
        "type": "address"
      }
    ],
    "name": "ContenderAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "version",
        "type": "uint8"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "nominee",
        "type": "address"
      }
    ],
    "name": "NewNominee",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "nominee",
        "type": "address"
      }
    ],
    "name": "NomineeExcluded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "oldNomineeVetter",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newNomineeVetter",
        "type": "address"
      }
    ],
    "name": "NomineeVetterChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      }
    ],
    "name": "ProposalCanceled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "proposer",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address[]",
        "name": "targets",
        "type": "address[]"
      },
      {
        "indexed": false,
        "internalType": "uint256[]",
        "name": "values",
        "type": "uint256[]"
      },
      {
        "indexed": false,
        "internalType": "string[]",
        "name": "signatures",
        "type": "string[]"
      },
      {
        "indexed": false,
        "internalType": "bytes[]",
        "name": "calldatas",
        "type": "bytes[]"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "startBlock",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "endBlock",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "description",
        "type": "string"
      }
    ],
    "name": "ProposalCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      }
    ],
    "name": "ProposalExecuted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "oldProposalThreshold",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newProposalThreshold",
        "type": "uint256"
      }
    ],
    "name": "ProposalThresholdSet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "oldQuorumNumerator",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newQuorumNumerator",
        "type": "uint256"
      }
    ],
    "name": "QuorumNumeratorUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "voter",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "support",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "weight",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "reason",
        "type": "string"
      }
    ],
    "name": "VoteCast",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "voter",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "contender",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "votes",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "totalUsedVotes",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "usableVotes",
        "type": "uint256"
      }
    ],
    "name": "VoteCastForContender",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "voter",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "proposalId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "support",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "weight",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "reason",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "bytes",
        "name": "params",
        "type": "bytes"
      }
    ],
    "name": "VoteCastWithParams",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "oldVotingDelay",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newVotingDelay",
        "type": "uint256"
      }
    ],
    "name": "VotingDelaySet",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "oldVotingPeriod",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "newVotingPeriod",
        "type": "uint256"
      }
    ],
    "name": "VotingPeriodSet",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "BALLOT_TYPEHASH",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "COUNTING_MODE",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "EXCLUDE_ADDRESS",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "EXTENDED_BALLOT_TYPEHASH",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "addContender",
    "outputs": [],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "bytes", "name": "signature", "type": "bytes" }
    ],
    "name": "addContender",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "uint8", "name": "", "type": "uint8" }
    ],
    "name": "castVote",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "uint8", "name": "", "type": "uint8" },
      { "internalType": "uint8", "name": "", "type": "uint8" },
      { "internalType": "bytes32", "name": "", "type": "bytes32" },
      { "internalType": "bytes32", "name": "", "type": "bytes32" }
    ],
    "name": "castVoteBySig",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "uint8", "name": "", "type": "uint8" },
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "name": "castVoteWithReason",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "uint8", "name": "support", "type": "uint8" },
      { "internalType": "string", "name": "reason", "type": "string" },
      { "internalType": "bytes", "name": "params", "type": "bytes" }
    ],
    "name": "castVoteWithReasonAndParams",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "uint8", "name": "support", "type": "uint8" },
      { "internalType": "string", "name": "reason", "type": "string" },
      { "internalType": "bytes", "name": "params", "type": "bytes" },
      { "internalType": "uint8", "name": "v", "type": "uint8" },
      { "internalType": "bytes32", "name": "r", "type": "bytes32" },
      { "internalType": "bytes32", "name": "s", "type": "bytes32" }
    ],
    "name": "castVoteWithReasonAndParamsBySig",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "name": "compliantNomineeCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "name": "compliantNominees",
    "outputs": [
      { "internalType": "address[]", "name": "", "type": "address[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "createElection",
    "outputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "currentCohort",
    "outputs": [{ "internalType": "enum Cohort", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "electionCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "electionIndex", "type": "uint256" }
    ],
    "name": "electionIndexToCohort",
    "outputs": [{ "internalType": "enum Cohort", "name": "", "type": "uint8" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "electionIndex", "type": "uint256" }
    ],
    "name": "electionIndexToDescription",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "electionIndex", "type": "uint256" }
    ],
    "name": "electionToTimestamp",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "address", "name": "nominee", "type": "address" }
    ],
    "name": "excludeNominee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "name": "excludedNomineeCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address[]", "name": "targets", "type": "address[]" },
      { "internalType": "uint256[]", "name": "values", "type": "uint256[]" },
      { "internalType": "bytes[]", "name": "calldatas", "type": "bytes[]" },
      {
        "internalType": "bytes32",
        "name": "descriptionHash",
        "type": "bytes32"
      }
    ],
    "name": "execute",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "firstNominationStartDate",
    "outputs": [
      { "internalType": "uint256", "name": "year", "type": "uint256" },
      { "internalType": "uint256", "name": "month", "type": "uint256" },
      { "internalType": "uint256", "name": "day", "type": "uint256" },
      { "internalType": "uint256", "name": "hour", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "blockNumber", "type": "uint256" }
    ],
    "name": "getPastCirculatingSupply",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "electionIndex", "type": "uint256" }
    ],
    "name": "getProposeArgs",
    "outputs": [
      { "internalType": "address[]", "name": "", "type": "address[]" },
      { "internalType": "uint256[]", "name": "", "type": "uint256[]" },
      { "internalType": "bytes[]", "name": "", "type": "bytes[]" },
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" },
      { "internalType": "uint256", "name": "blockNumber", "type": "uint256" }
    ],
    "name": "getVotes",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" },
      { "internalType": "uint256", "name": "blockNumber", "type": "uint256" },
      { "internalType": "bytes", "name": "params", "type": "bytes" }
    ],
    "name": "getVotesWithParams",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "hasVoted",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address[]", "name": "targets", "type": "address[]" },
      { "internalType": "uint256[]", "name": "values", "type": "uint256[]" },
      { "internalType": "bytes[]", "name": "calldatas", "type": "bytes[]" },
      {
        "internalType": "bytes32",
        "name": "descriptionHash",
        "type": "bytes32"
      }
    ],
    "name": "hashProposal",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "includeNominee",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          {
            "components": [
              { "internalType": "uint256", "name": "year", "type": "uint256" },
              { "internalType": "uint256", "name": "month", "type": "uint256" },
              { "internalType": "uint256", "name": "day", "type": "uint256" },
              { "internalType": "uint256", "name": "hour", "type": "uint256" }
            ],
            "internalType": "struct Date",
            "name": "firstNominationStartDate",
            "type": "tuple"
          },
          {
            "internalType": "uint256",
            "name": "nomineeVettingDuration",
            "type": "uint256"
          },
          {
            "internalType": "address",
            "name": "nomineeVetter",
            "type": "address"
          },
          {
            "internalType": "contract ISecurityCouncilManager",
            "name": "securityCouncilManager",
            "type": "address"
          },
          {
            "internalType": "contract ISecurityCouncilMemberElectionGovernor",
            "name": "securityCouncilMemberElectionGovernor",
            "type": "address"
          },
          {
            "internalType": "contract IVotesUpgradeable",
            "name": "token",
            "type": "address"
          },
          { "internalType": "address", "name": "owner", "type": "address" },
          {
            "internalType": "uint256",
            "name": "quorumNumeratorValue",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "votingPeriod",
            "type": "uint256"
          }
        ],
        "internalType": "struct SecurityCouncilNomineeElectionGovernor.InitParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "isCompliantNominee",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      {
        "internalType": "address",
        "name": "possibleContender",
        "type": "address"
      }
    ],
    "name": "isContender",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      {
        "internalType": "address",
        "name": "possibleExcluded",
        "type": "address"
      }
    ],
    "name": "isExcluded",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "address", "name": "contender", "type": "address" }
    ],
    "name": "isNominee",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "name": "nomineeCount",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nomineeVetter",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "nomineeVettingDuration",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "name": "nominees",
    "outputs": [
      { "internalType": "address[]", "name": "", "type": "address[]" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "uint256[]", "name": "", "type": "uint256[]" },
      { "internalType": "uint256[]", "name": "", "type": "uint256[]" },
      { "internalType": "bytes", "name": "", "type": "bytes" }
    ],
    "name": "onERC1155BatchReceived",
    "outputs": [{ "internalType": "bytes4", "name": "", "type": "bytes4" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "bytes", "name": "", "type": "bytes" }
    ],
    "name": "onERC1155Received",
    "outputs": [{ "internalType": "bytes4", "name": "", "type": "bytes4" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "bytes", "name": "", "type": "bytes" }
    ],
    "name": "onERC721Received",
    "outputs": [{ "internalType": "bytes4", "name": "", "type": "bytes4" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "otherCohort",
    "outputs": [{ "internalType": "enum Cohort", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "name": "proposalDeadline",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "name": "proposalSnapshot",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "proposalThreshold",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "name": "proposalVettingDeadline",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address[]", "name": "", "type": "address[]" },
      { "internalType": "uint256[]", "name": "", "type": "uint256[]" },
      { "internalType": "bytes[]", "name": "", "type": "bytes[]" },
      { "internalType": "string", "name": "", "type": "string" }
    ],
    "name": "propose",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "blockNumber", "type": "uint256" }
    ],
    "name": "quorum",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "quorumDenominator",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "blockNumber", "type": "uint256" }
    ],
    "name": "quorumNumerator",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "quorumNumerator",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "bytes", "name": "signature", "type": "bytes" }
    ],
    "name": "recoverAddContenderMessage",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "target", "type": "address" },
      { "internalType": "uint256", "name": "value", "type": "uint256" },
      { "internalType": "bytes", "name": "data", "type": "bytes" }
    ],
    "name": "relay",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "securityCouncilManager",
    "outputs": [
      {
        "internalType": "contract ISecurityCouncilManager",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "securityCouncilMemberElectionGovernor",
    "outputs": [
      {
        "internalType": "contract ISecurityCouncilMemberElectionGovernor",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "_nomineeVetter", "type": "address" }
    ],
    "name": "setNomineeVetter",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "newProposalThreshold",
        "type": "uint256"
      }
    ],
    "name": "setProposalThreshold",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "newVotingDelay", "type": "uint256" }
    ],
    "name": "setVotingDelay",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "newVotingPeriod",
        "type": "uint256"
      }
    ],
    "name": "setVotingPeriod",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" }
    ],
    "name": "state",
    "outputs": [
      {
        "internalType": "enum IGovernorUpgradeable.ProposalState",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" }
    ],
    "name": "supportsInterface",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "token",
    "outputs": [
      {
        "internalType": "contract IVotesUpgradeable",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "newOwner", "type": "address" }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "newQuorumNumerator",
        "type": "uint256"
      }
    ],
    "name": "updateQuorumNumerator",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "name": "usedNonces",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "version",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "address", "name": "contender", "type": "address" }
    ],
    "name": "votesReceived",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "proposalId", "type": "uint256" },
      { "internalType": "address", "name": "account", "type": "address" }
    ],
    "name": "votesUsed",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "votingDelay",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "votingPeriod",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  { "stateMutability": "payable", "type": "receive" }
]
"#
);
