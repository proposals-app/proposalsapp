import type { Abi, Address } from 'viem';
import { arbitrum, mainnet } from 'viem/chains';

export const SNAPSHOT_HUB_URL = 'https://hub.snapshot.org';

export const GOVERNOR_VOTE_ABI = [
  {
    type: 'function',
    name: 'castVote',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'castVoteWithReason',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proposalId', type: 'uint256' },
      { name: 'support', type: 'uint8' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const satisfies Abi;

type OnchainGovernorConfig = {
  kind: 'onchain';
  address: Address;
  chainId: number;
};

type SnapshotGovernorConfig = {
  kind: 'snapshot';
  space: string;
  hubUrl: string;
};

export const GOVERNOR_CONFIG = {
  ARBITRUM_SNAPSHOT: {
    kind: 'snapshot',
    space: 'arbitrumfoundation.eth',
    hubUrl: SNAPSHOT_HUB_URL,
  },
  ARBITRUM_CORE: {
    kind: 'onchain',
    address: '0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9',
    chainId: arbitrum.id,
  },
  ARBITRUM_TREASURY: {
    kind: 'onchain',
    address: '0x789fC99093B09aD01C34DC7251D0C89ce743e5a4',
    chainId: arbitrum.id,
  },
  UNISWAP_SNAPSHOT: {
    kind: 'snapshot',
    space: 'uniswapgovernance.eth',
    hubUrl: SNAPSHOT_HUB_URL,
  },
  UNISWAP_GOVERNOR: {
    kind: 'onchain',
    address: '0x408ED6354d4973f66138C91495F2f2FCbd8724C3',
    chainId: mainnet.id,
  },
} as const satisfies Record<
  string,
  OnchainGovernorConfig | SnapshotGovernorConfig
>;

export type SupportedGovernorType = keyof typeof GOVERNOR_CONFIG;
