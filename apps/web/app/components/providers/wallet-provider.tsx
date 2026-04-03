'use client';

import {
  RainbowKitProvider,
  darkTheme,
  lightTheme,
} from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { getWagmiConfig } from '@/lib/wagmi-config';
import { useAppTheme } from './app-theme-provider';
import { getThemeAccent } from '@/lib/theme';

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { mode, variant } = useAppTheme();
  const [mounted, setMounted] = useState(false);
  const [queryClient] = useState(() => new QueryClient());
  const [config, setConfig] = useState<ReturnType<typeof getWagmiConfig> | null>(
    null
  );

  useEffect(() => {
    setMounted(true);
    setConfig(getWagmiConfig());
  }, []);

  // RainbowKit/WalletConnect touch browser storage APIs during SSR.
  // Keep the app shell renderable on the server, then mount the wallet stack
  // on the client once those APIs are available.
  if (!mounted || !config) {
    return <>{children}</>;
  }

  const walletTheme =
    mode === 'dark'
      ? darkTheme({
          accentColor: getThemeAccent(variant),
          accentColorForeground: 'white',
          borderRadius: 'none',
        })
      : lightTheme({
          accentColor: getThemeAccent(variant),
          accentColorForeground: 'white',
          borderRadius: 'none',
        });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider modalSize='compact' theme={walletTheme}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
