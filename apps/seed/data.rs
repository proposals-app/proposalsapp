use seaorm::sea_orm_active_enums::DaoHandlerEnumV2;

use crate::{DaoSeedData, HandlerData, SettingsData};

pub fn seed_data() -> Vec<DaoSeedData> {
    vec![
        DaoSeedData {
            name: "Aave".to_string(),
            slug: "aave".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/aave".to_string(),
                background_color: "#a5a9c6".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::Snapshot,
                    governance_portal: "https://snapshot.org/#/aave.eth".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::AaveV2Mainnet,
                    governance_portal: "https://app.aave.com/governance".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::AaveV3Mainnet,
                    governance_portal: "https://app.aave.com/governance".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::AaveV3PolygonPos,
                    governance_portal: "https://app.aave.com/governance".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::AaveV3Avalanche,
                    governance_portal: "https://app.aave.com/governance".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Compound".to_string(),
            slug: "compound".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/compound".to_string(),
                background_color: "#00573e".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::Snapshot,
                    governance_portal: "https://snapshot.org/#/comp-vote.eth".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::CompoundMainnet,
                    governance_portal: "https://compound.finance/governance".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "dYdX".to_string(),
            slug: "dydx".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/dYdX".to_string(),
                background_color: "#51515a".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::Snapshot,
                    governance_portal: "https://snapshot.org/#/dydxgov.eth".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::DydxMainnet,
                    governance_portal: "https://dydx.community/dashboard".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "ENS".to_string(),
            slug: "ens".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/ens".to_string(),
                background_color: "#6daef6".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::Snapshot,
                    governance_portal: "https://snapshot.org/#/ens.eth".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::EnsMainnet,
                    governance_portal: "https://www.tally.xyz/gov/ens".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Gitcoin".to_string(),
            slug: "gitcoin".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/gitcoin".to_string(),
                background_color: "#05d4a2".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::Snapshot,
                    governance_portal: "https://snapshot.org/#/gitcoindao.eth".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::GitcoinMainnet,
                    governance_portal: "https://www.tally.xyz/gov/gitcoin".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::GitcoinV2Mainnet,
                    governance_portal: "https://www.tally.xyz/gov/gitcoin".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Hop Protocol".to_string(),
            slug: "hop_protocol".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/hop-protocol".to_string(),
                background_color: "#d27ecc".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::Snapshot,
                    governance_portal: "https://snapshot.org/#/hop.eth".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::HopMainnet,
                    governance_portal: "https://www.tally.xyz/gov/hop".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Uniswap".to_string(),
            slug: "uniswap".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/uniswap".to_string(),
                background_color: "#ffd5f5".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::Snapshot,
                    governance_portal: "https://snapshot.org/#/uniswapgovernance.eth".to_string(),

                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::UniswapMainnet,
                    governance_portal: "https://app.uniswap.org/#/vote".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Optimism".to_string(),
            slug: "optimism".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/optimism".to_string(),
                background_color: "#ff444b".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::Snapshot,
                    governance_portal: "https://snapshot.org/#/opcollective.eth".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::OpOptimism,
                    governance_portal: "https://vote.optimism.io/proposals".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Arbitrum DAO".to_string(),
            slug: "arbitrum_dao".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/arbitrum".to_string(),
                background_color: "#55677b".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::Snapshot,
                    governance_portal: "https://snapshot.org/#/arbitrumfoundation.eth".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::ArbCoreArbitrum,
                    governance_portal: "https://www.tally.xyz/gov/arbitrum".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::ArbTreasuryArbitrum,
                    governance_portal: "https://www.tally.xyz/gov/arbitrum".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Frax".to_string(),
            slug: "frax".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/frax".to_string(),
                background_color: "#484848".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::Snapshot,
                    governance_portal: "https://snapshot.org/#/frax.eth".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::FraxAlphaMainnet,
                    governance_portal: "https://app.frax.finance/gov/frax".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::FraxOmegaMainnet,
                    governance_portal: "https://app.frax.finance/gov/frax".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Nouns".to_string(),
            slug: "nouns".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/nouns".to_string(),
                background_color: "#904757".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: DaoHandlerEnumV2::NounsProposalsMainnet,
                governance_portal: "https://nouns.wtf/vote".to_string(),
                refresh_enabled: true,
                proposals_index: 0,
                proposals_refresh_speed: 1_000_000,
                votes_index: 0,
                votes_refresh_speed: 1_000_000,
            }],
        },
        DaoSeedData {
            name: "MakerDAO".to_string(),
            slug: "makerdao".to_string(),
            hot: true,
            settings: SettingsData {
                picture: "assets/project-logos/makerdao".to_string(),
                background_color: "#68baaa".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: DaoHandlerEnumV2::MakerExecutiveMainnet,
                    governance_portal: "https://vote.makerdao.com/executive".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::MakerPollMainnet,
                    governance_portal: "https://vote.makerdao.com/polling/".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: DaoHandlerEnumV2::MakerPollArbitrum,
                    governance_portal: "https://vote.makerdao.com/polling/".to_string(),
                    refresh_enabled: true,
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
    ]
}
