import type { GlobalProvider } from '@ladle/react';
import WalletProvider from '../app/components/wallet-provider';
import React from 'react';

export const Provider: GlobalProvider = ({
  children,
  globalState,
  storyMeta,
}) => <WalletProvider>{children}</WalletProvider>;
