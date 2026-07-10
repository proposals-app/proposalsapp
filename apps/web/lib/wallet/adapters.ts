import { Web3Provider } from '@ethersproject/providers';
import type { Account, Chain, Client, Transport } from 'viem';

export function clientToWeb3Provider(
  client: Client<Transport, Chain, Account>
) {
  const { chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  // Snapshot.js calls the ethers v5 Signer._signTypedData API. Its v6
  // replacement is not runtime-compatible even though both are EIP-1193
  // providers, so retain this narrow v5 adapter at the integration boundary.
  return new Web3Provider(transport, network);
}
