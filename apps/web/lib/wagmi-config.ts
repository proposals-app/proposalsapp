'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { cookieStorage, createStorage, http } from 'wagmi';
import { arbitrum } from 'wagmi/chains';

export function getWagmiConfig() {
  return getDefaultConfig({
    appName: 'proposalsapp',
    projectId: 'e18a2020baa088921415dd06caf2bfb4',
    chains: [arbitrum],
    ssr: true,
    storage: createStorage({
      storage: cookieStorage,
    }),
    transports: {
      [arbitrum.id]: http(),
    },
  });
}
