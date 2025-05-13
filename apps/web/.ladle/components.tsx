'use client';

import type { GlobalProvider } from '@ladle/react';
import React from 'react';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { defineChain } from 'viem'; // Import defineChain
import '@rainbow-me/rainbowkit/styles.css';

// Define a local version of the Arbitrum chain
const arbitrumLocalhost = defineChain({
  id: 42_161,
  name: 'Arbitrum Localhost', // Give it a distinct name
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      // Point to the local node
      http: ['http://localhost:8545'],
    },
  },
  // Keep other properties consistent with Arbitrum One if needed,
  // or remove them if they are not relevant for local testing
  blockExplorers: {
    default: {
      name: 'Localhost Explorer',
      url: 'http://localhost:4000', // Placeholder, adjust if you have a local explorer
      apiUrl: 'http://localhost:4000/api', // Placeholder
    },
  },
  contracts: {
    // Multicall3 address might be different or non-existent on a local node.
    // Use the default or find the correct one for your local setup.
    // Using the standard one might work if the local node supports it at that address.
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 7654707, // This block number is for Arbitrum One mainnet
    },
  },
});

const config = getDefaultConfig({
  appName: 'proposalsapp',
  projectId: 'e18a2020baa088921415dd06caf2bfb4', // Keep or replace with a local dev ID if desired
  chains: [arbitrumLocalhost], // Use the locally defined chain
  ssr: true,
});

const queryClient = new QueryClient();

function TestWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// The GlobalProvider should wrap the children with the TestWalletProvider
export const Provider: GlobalProvider = ({
  children,
  globalState, // Unused in this example
  storyMeta, // Unused in this example
}) => <TestWalletProvider>{children}</TestWalletProvider>;
