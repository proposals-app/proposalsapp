import { type fetchItemsType } from "../../actions";
import SnapshotItem from "./items/snapshot_item";
import MainnetItem from "./items/mainnet_item";
import OptimismItem from "./items/optimism_item";
import ArbitrumItem from "./items/arbitrum_item";
import MakerItem from "./items/maker_item";

export default function Item(props: { item: fetchItemsType["proposals"][0] }) {
  switch (props.item.daoHandlerType) {
    case "SNAPSHOT":
      return <SnapshotItem item={props.item} />;
    case "AAVE_V2_MAINNET":
    case "AAVE_V3_MAINNET":
    case "COMPOUND_MAINNET":
    case "DYDX_MAINNET":
    case "ENS_MAINNET":
    case "GITCOIN_MAINNET":
    case "GITCOIN_V2_MAINNET":
    case "HOP_MAINNET":
    case "INTEREST_PROTOCOL_MAINNET":
    case "UNISWAP_MAINNET":
    case "ZEROX_PROTOCOL_MAINNET":
    case "FRAX_ALPHA_MAINNET":
    case "FRAX_OMEGA_MAINNET":
    case "NOUNS_PROPOSALS_MAINNET":
    case "MAKER_POLL_MAINNET":
      return <MainnetItem item={props.item} />;
    case "MAKER_EXECUTIVE_MAINNET":
      return <MakerItem item={props.item} />;
    case "OP_OPTIMISM":
      return <OptimismItem item={props.item} />;
    case "ARB_CORE_ARBITRUM":
    case "ARB_TREASURY_ARBITRUM":
      return <ArbitrumItem item={props.item} />;
  }
}
