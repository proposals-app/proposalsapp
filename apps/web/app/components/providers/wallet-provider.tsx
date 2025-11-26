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
import { useEffect, useState } from 'react';

// Create a stable QueryClient instance outside the component
const queryClient = new QueryClient();

// Module-level singleton for wagmi config
// This ensures the same config is used across all components
// and prevents recreation on re-renders or hot module reloads
let configSingleton: ReturnType<typeof getDefaultConfig> | null = null;
let configInitialized = false;

function getWagmiConfig() {
  // Only create config on client-side
  if (typeof window === 'undefined') {
    return null;
  }

  // Return existing singleton if available
  if (configInitialized && configSingleton) {
    return configSingleton;
  }

  // Create new config (this should only happen once per page load)
  configSingleton = getDefaultConfig({
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

  configInitialized = true;
  return configSingleton;
}

export default function WalletProvider({
  children,
  cookie,
}: {
  children: React.ReactNode;
  cookie?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<ReturnType<
    typeof getDefaultConfig
  > | null>(null);

  // Initialize config only on client-side after mount
  useEffect(() => {
    setMounted(true);
    const wagmiConfig = getWagmiConfig();
    setConfig(wagmiConfig);
  }, []);

  // Don't render wallet providers until mounted and config is available
  // This prevents hydration mismatches between server and client
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
