import {
  arbitrum,
  avalanche,
  base,
  blast,
  bsc,
  celo,
  filecoin,
  gnosis,
  linea,
  mainnet,
  manta,
  mantle,
  moonbeam,
  optimism,
  polygon,
  polygonZkEvm,
  redstone,
  rootstock,
  scroll,
  sei,
  taiko,
  worldchain,
  zkSync,
  zora,
} from 'viem/chains';

// Source: https://github.com/uniswapfoundation/governance-processes/blob/main/TREASURY_ADDRESSES.md
export const UNISWAP_TREASURY_ADDRESSES = [
  {
    address: '0x1a9C8182C09F50C8318d769245beA52c32BE35BC',
    chainId: mainnet.id,
  },
  {
    address: '0x2BAD8182C09F50c8318d769245beA52C32Be46CD',
    chainId: arbitrum.id,
  },
  {
    address: '0xeb0BCF27D1Fb4b25e708fBB815c421Aeb51eA9fc',
    chainId: avalanche.id,
  },
  { address: '0x31FAfd4889FA1269F7a13A66eE0fB458f27D72A9', chainId: base.id },
  { address: '0x2339C0d23b60739B3E5ABF201F05903D24A26C77', chainId: blast.id },
  { address: '0x53163235746CeB81Da32293bb0932e1A599256B4', chainId: 288 },
  { address: '0x341c1511141022cf8eE20824Ae0fFA3491F1302b', chainId: bsc.id },
  { address: '0x0Eb863541278308c3A64F8E908BC646e27BFD071', chainId: celo.id },
  {
    address: '0xFf3b2DA1379cc67cc2755194604713f10b820b0E',
    chainId: filecoin.id,
  },
  { address: '0xfFA5599136fBaB9af7799A6703b57BB33E5390Cf', chainId: gnosis.id },
  { address: '0x581F86Da293A1D5Cd087a10E7227a75d2d2201A8', chainId: linea.id },
  { address: '0x683553d74D9779955a15d57D208234C956B6Eae6', chainId: manta.id },
  { address: '0x9b7aC6735b23578E81260acD34E3668D0cc6000A', chainId: mantle.id },
  {
    address: '0xB2af16D6c7074228fC487F17929De830303E6531',
    chainId: moonbeam.id,
  },
  {
    address: '0xa1dD330d602c32622AA270Ea73d078B803Cb3518',
    chainId: optimism.id,
  },
  {
    address: '0x8a1B966aC46F42275860f905dbC75EfBfDC12374',
    chainId: polygon.id,
  },
  {
    address: '0x1808cc3ffb04e8bB67BfEB5510D44e62cF380717',
    chainId: polygonZkEvm.id,
  },
  {
    address: '0x2d00e94d78Fc307FC5E6195BBe2fB6aFC2FC07d4',
    chainId: redstone.id,
  },
  {
    address: '0x38aE7De6f9c51e17f49cF5730DD5F2d29fa20758',
    chainId: rootstock.id,
  },
  { address: '0xEfc9D1096fb65c832207E5e7F13C2D1102244dbe', chainId: scroll.id },
  { address: '0xe75358526ef4441db03ccaeb9a87f180fae80eb9', chainId: sei.id },
  { address: '0xf6b53E8dA8bc7dbddB8E7B39635d17D7CCdCD6E5', chainId: taiko.id },
  {
    address: '0xcb2436774C3e191c85056d248EF4260ce5f27A9D',
    chainId: worldchain.id,
  },
  { address: '0x2BAD8182C09F50c8318d769245beA52C32Be46CD', chainId: zkSync.id },
  { address: '0x36eEC182D0B24Df3DC23115D64DB521A93D5154f', chainId: zora.id },
] as const;
