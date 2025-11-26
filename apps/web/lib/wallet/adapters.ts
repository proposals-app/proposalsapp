import { BrowserProvider } from 'ethers';
import type { Account, Chain, Client, Transport } from 'viem';

// Type alias for snapshot.js compatibility
// snapshot.js expects ethers v5 Web3Provider, but BrowserProvider from v6
// has the same runtime interface for signing messages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SnapshotCompatibleProvider = any;

export function clientToWeb3Provider(
  client: Client<Transport, Chain, Account>
): SnapshotCompatibleProvider {
  const { chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  // ethers v6 uses BrowserProvider instead of providers.Web3Provider
  // The runtime behavior is compatible with snapshot.js despite the type difference
  const provider = new BrowserProvider(transport, network);
  return provider;
}
