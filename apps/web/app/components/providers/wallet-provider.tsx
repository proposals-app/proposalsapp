'use client';

import {
  RainbowKitProvider,
  darkTheme,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import {
  WagmiProvider,
  cookieToInitialState,
  cookieStorage,
  createStorage,
  http,
} from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, useEffect, useState } from 'react';

// Create a stable QueryClient instance outside the component
const queryClient = new QueryClient();

// Create config only once, outside the component
let configInstance: ReturnType<typeof getDefaultConfig> | null = null;

function getOrCreateConfig() {
  if (!configInstance && typeof window !== 'undefined') {
    configInstance = getDefaultConfig({
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
  return configInstance;
}

export default function WalletProvider({
  children,
  cookie,
}: {
  children: React.ReactNode;
  cookie?: string | null;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get or create config
  const config = useMemo(() => {
    if (typeof window === 'undefined') {
      // Return a dummy config for SSR that won't initialize WalletConnect
      return null;
    }
    return getOrCreateConfig();
  }, []);

  // Don't render until mounted and config is available
  if (!mounted || !config) {
    return <>{children}</>;
  }

  // Convert cookie to initial state for SSR hydration
  const initialState = cookieToInitialState(config, cookie);

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          modalSize='compact'
          theme={darkTheme({
            accentColor: '#7b3fe4',
            accentColorForeground: 'white',
            borderRadius: 'none',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
