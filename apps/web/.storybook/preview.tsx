import type { Preview } from '@storybook/nextjs';
import React from 'react';
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { defineChain } from 'viem';
import '@rainbow-me/rainbowkit/styles.css';
import '../styles/globals.css';
import { Toaster } from '../app/components/ui/sonner';

// Define a local version of the Arbitrum chain
const arbitrumLocalhost = defineChain({
  id: 42_161,
  name: 'Arbitrum Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Localhost Explorer',
      url: 'http://localhost:4000',
      apiUrl: 'http://localhost:4000/api',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 7654707,
    },
  },
});

const config = getDefaultConfig({
  appName: 'proposalsapp',
  projectId: 'e18a2020baa088921415dd06caf2bfb4',
  chains: [arbitrumLocalhost],
  ssr: true,
});

const queryClient = new QueryClient();

function TestWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <div className='light' data-theme='arbitrum'>
          <RainbowKitProvider
            modalSize='compact'
            theme={darkTheme({
              accentColor: 'var(--neutral-800)',
              accentColorForeground: 'var(--neutral-200)',
              borderRadius: 'none',
              overlayBlur: 'small',
            })}
          >
            <Toaster />
            {children}
          </RainbowKitProvider>
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
  decorators: [
    (Story) => (
      <TestWalletProvider>
        <Story />
      </TestWalletProvider>
    ),
  ],
};

export default preview;
