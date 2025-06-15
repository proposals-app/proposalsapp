import type { Preview } from '@storybook/nextjs';
import React from 'react';
import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { arbitrum } from 'viem/chains';
import { defineChain } from 'viem';
import '@rainbow-me/rainbowkit/styles.css';
import '../styles/globals.css';
import { Toaster } from '../app/components/ui/sonner';
import { chromaticDecorator } from './chromatic-decorator';
import { withDomSizer } from './dom-sizer-addon/preview';

// Define a local version of the Arbitrum chain for onchain testing
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

// Determine which chain configuration to use based on the story
// For onchain stories, we need localhost (requires Anvil)
// For offchain stories (Snapshot), we can use the public Arbitrum network
function getChainConfig() {
  // Check if we're in an onchain story by looking at the URL
  if (typeof window !== 'undefined') {
    const url = window.location.href;
    const isOnchainStory = url.includes('on-chain') || url.includes('onchain');

    if (isOnchainStory) {
      console.log('Using localhost chain for onchain story');
      return [arbitrumLocalhost] as const;
    }
  }

  console.log('Using public Arbitrum chain for offchain story');
  return [arbitrum] as const;
}

const config = getDefaultConfig({
  appName: 'proposalsapp',
  projectId: 'e18a2020baa088921415dd06caf2bfb4',
  chains: getChainConfig(),
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
    // Global Chromatic configuration
    chromatic: {
      // Default viewport sizes for all stories
      viewports: [320, 768, 1200],
      // Default delay for animations to complete
      delay: 300,
      // Disable animations for consistent screenshots by default
      pauseAnimationAtEnd: true,
      // Default diffing options
      diffThreshold: 0.2,
      diffIncludeAntiAliasing: false,
    },
  },
  decorators: [
    (Story) => (
      <TestWalletProvider>
        <Story />
      </TestWalletProvider>
    ),
    chromaticDecorator,
    withDomSizer,
  ],
};

export default preview;
