import { providers } from 'ethers';
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
  const provider = new providers.Web3Provider(transport, network);
  return provider;
}
