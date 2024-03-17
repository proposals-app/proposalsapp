use crate::{DaoSeedData, HandlerData, SettingsData};
use seaorm::sea_orm_active_enums::HandlerType;
use serde_json::json;

pub fn seed_data() -> Vec<DaoSeedData> {
    vec![
        DaoSeedData {
            name: "Aave".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/aave".to_string(),
                background_color: "#a5a9c6".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/aave.eth".to_string(),
                    decoder: json!({"snapshot_space": "aave.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::AaveV2Mainnet,
                    governance_portal: "https://app.aave.com/governance".to_string(),
                    decoder: json!({
                        "address": "0xEC568fffba86c094cf06b22134B23074DFE2252c",
                        "proposalUrl": "https://app.aave.com/governance/proposal/?proposalId=",
                    }),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: HandlerType::AaveV3Mainnet,
                    governance_portal: "https://app.aave.com/governance".to_string(),
                    decoder: json!({
                        "address": "0x9AEE0B04504CeF83A65AC3f0e838D0593BCb2BC7",
                        "voting_machine": "0x617332a777780F546261247F621051d0b98975Eb",
                        "proposalUrl": "https://app.aave.com/governance/v3/proposal/?proposalId=",
                    }),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: HandlerType::AaveV3PolygonPos,
                    governance_portal: "https://app.aave.com/governance".to_string(),
                    decoder: json!({
                        "voting_machine": "0xc8a2ADC4261c6b669CdFf69E717E77C9cFeB420d",
                        "proposalUrl": "https://app.aave.com/governance/v3/proposal/?proposalId=",
                    }),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: HandlerType::AaveV3Avalanche,
                    governance_portal: "https://app.aave.com/governance".to_string(),
                    decoder: json!({
                        "voting_machine": "0x9b6f5ef589A3DD08670Dd146C11C4Fb33E04494F",
                        "proposalUrl": "https://app.aave.com/governance/v3/proposal/?proposalId=",
                    }),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Compound".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/compound".to_string(),
                background_color: "#00573e".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/comp-vote.eth".to_string(),
                    decoder: json!({"snapshot_space": "comp-vote.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::CompoundMainnet,
                    governance_portal: "https://compound.finance/governance".to_string(),
                    decoder: json!({"proposalUrl": "https://compound.finance/governance/proposals/", "address":"0xc0Da02939E1441F497fd74F78cE7Decb17B66529"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "dYdX".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/dYdX".to_string(),
                background_color: "#51515a".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/dydxgov.eth".to_string(),
                    decoder: json!({"snapshot_space": "dydxgov.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::DydxMainnet,
                    governance_portal: "https://dydx.community/dashboard".to_string(),
                    decoder: json!({"address": "0x7E9B1672616FF6D6629Ef2879419aaE79A9018D2", "proposalUrl": "https://dydx.community/dashboard/proposal/",}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "ENS".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/ens".to_string(),
                background_color: "#6daef6".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/ens.eth".to_string(),
                    decoder: json!({"snapshot_space": "ens.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::EnsMainnet,
                    governance_portal: "https://www.tally.xyz/gov/ens".to_string(),
                    decoder: json!({"address": "0x323A76393544d5ecca80cd6ef2A560C6a395b7E3", "proposalUrl": "https://www.tally.xyz/gov/ens/proposal/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Gitcoin".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/gitcoin".to_string(),
                background_color: "#05d4a2".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/gitcoindao.eth".to_string(),
                    decoder: json!({"snapshot_space": "gitcoindao.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::GitcoinMainnet,
                    governance_portal: "https://www.tally.xyz/gov/gitcoin".to_string(),
                    decoder: json!({"address": "0xDbD27635A534A3d3169Ef0498beB56Fb9c937489", "proposalUrl": "https://www.tally.xyz/gov/gitcoin/proposal/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: HandlerType::GitcoinV2Mainnet,
                    governance_portal: "https://www.tally.xyz/gov/gitcoin".to_string(),
                    decoder: json!({"address": "0x9D4C63565D5618310271bF3F3c01b2954C1D1639", "proposalUrl": "https://www.tally.xyz/gov/gitcoin/proposal/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Hop Protocol".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/hop-protocol".to_string(),
                background_color: "#d27ecc".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/hop.eth".to_string(),
                    decoder: json!({"snapshot_space": "hop.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::HopMainnet,
                    governance_portal: "https://www.tally.xyz/gov/hop".to_string(),
                    decoder: json!({"address": "0xed8Bdb5895B8B7f9Fdb3C087628FD8410E853D48", "proposalUrl": "https://www.tally.xyz/gov/hop/proposal/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Interest Protocol".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/interest".to_string(),
                background_color: "#c3d1bc".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::InterestProtocolMainnet,
                governance_portal: "https://interestprotocol.io/#/proposal/".to_string(),
                decoder: json!({"address": "0x266d1020A84B9E8B0ed320831838152075F8C4cA", "proxyAddress":"0x6b91A0Ba78Acc4a8C7919f96c181a895D5b31563", "proposalUrl": "https://interestprotocol.io/#/proposal/"}),
                proposals_index: 0,
                proposals_refresh_speed: 1_000_000,
                votes_index: 0,
                votes_refresh_speed: 1_000_000,
            }],
        },
        DaoSeedData {
            name: "Uniswap".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/uniswap".to_string(),
                background_color: "#ffd5f5".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/uniswapgovernance.eth".to_string(),
                    decoder: json!({"snapshot_space": "uniswapgovernance.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::UniswapMainnet,
                    governance_portal: "https://app.uniswap.org/#/vote".to_string(),
                    decoder: json!({"address": "0x408ED6354d4973f66138C91495F2f2FCbd8724C3", "proxyAddress":"0x53a328f4086d7c0f1fa19e594c9b842125263026", "proposalUrl": "https://app.uniswap.org/#/vote/2/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "0x Protocol".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/0x-protocol".to_string(),
                background_color: "#636364".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/0xgov.eth".to_string(),
                    decoder: json!({"snapshot_space": "0xgov.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::ZeroxProtocolMainnet,
                    governance_portal: "https://governance.0xprotocol.org/vote".to_string(),
                    decoder: json!({ "address": "0x0bB1810061C2f5b2088054eE184E6C79e1591101", "stakingProxy": "0xa26e80e7dea86279c6d778d702cc413e6cffa777", "proposalUrl": "https://governance.0xprotocol.org/vote/proposal/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Optimism".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/optimism".to_string(),
                background_color: "#ff444b".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/opcollective.eth".to_string(),
                    decoder: json!({"snapshot_space": "opcollective.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::OpOptimism,
                    governance_portal: "https://vote.optimism.io/proposals".to_string(),
                    decoder: json!({ "address": "0xcDF27F107725988f2261Ce2256bDfCdE8B382B10", "proposalUrl": "https://vote.optimism.io/proposals/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Arbitrum DAO".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/arbitrum".to_string(),
                background_color: "#55677b".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/arbitrumfoundation.eth".to_string(),
                    decoder: json!({"snapshot_space": "arbitrumfoundation.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::ArbCoreArbitrum,
                    governance_portal: "https://www.tally.xyz/gov/arbitrum".to_string(),
                    decoder: json!({ "address": "0xf07DeD9dC292157749B6Fd268E37DF6EA38395B9", "proposalUrl": "https://www.tally.xyz/gov/arbitrum/proposal/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: HandlerType::ArbTreasuryArbitrum,
                    governance_portal: "https://www.tally.xyz/gov/arbitrum".to_string(),
                    decoder: json!({ "address": "0x789fC99093B09aD01C34DC7251D0C89ce743e5a4", "proposalUrl": "https://www.tally.xyz/gov/arbitrum/proposal/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Frax".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/frax".to_string(),
                background_color: "#484848".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::Snapshot,
                    governance_portal: "https://snapshot.org/#/frax.eth".to_string(),
                    decoder: json!({"snapshot_space": "frax.eth"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1000,
                    votes_index: 0,
                    votes_refresh_speed: 0,
                },
                HandlerData {
                    handler_type: HandlerType::FraxAlphaMainnet,
                    governance_portal: "https://app.frax.finance/gov/frax".to_string(),
                    decoder: json!({ "address": "0xe8Ab863E629a05c73D6a23b99d37027E3763156e", "proposalUrl": "https://app.frax.finance/gov/frax/proposals/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: HandlerType::FraxOmegaMainnet,
                    governance_portal: "https://app.frax.finance/gov/frax".to_string(),
                    decoder: json!({ "address": "0x953791d7c5ac8ce5fb23bbbf88963da37a95fe7a", "proposalUrl": "https://app.frax.finance/gov/frax/proposals/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Nouns".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/nouns".to_string(),
                background_color: "#904757".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::NounsProposalsMainnet,
                governance_portal: "https://nouns.wtf/vote".to_string(),
                decoder: json!({ "address": "0x6f3E6272A167e8AcCb32072d08E0957F9c79223d", "proposalUrl": "https://nouns.wtf/vote/"}),
                proposals_index: 0,
                proposals_refresh_speed: 1_000_000,
                votes_index: 0,
                votes_refresh_speed: 1_000_000,
            }],
        },
        DaoSeedData {
            name: "MakerDAO".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/makerdao".to_string(),
                background_color: "#68baaa".to_string(),
            },
            handlers: vec![
                HandlerData {
                    handler_type: HandlerType::MakerExecutiveMainnet,
                    governance_portal: "https://vote.makerdao.com/executive".to_string(),
                    decoder: json!({ "address": "0x0a3f6849f78076aefaDf113F5BED87720274dDC0", "proposalUrl": "https://vote.makerdao.com/executive/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: HandlerType::MakerPollMainnet,
                    governance_portal: "https://vote.makerdao.com/polling/".to_string(),
                    decoder: json!({ "address_create": "0xf9be8f0945acddeedaa64dfca5fe9629d0cf8e5d", "address_vote": "0xD3A9FE267852281a1e6307a1C37CDfD76d39b133", "proposalUrl": "https://vote.makerdao.com/polling/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
                HandlerData {
                    handler_type: HandlerType::MakerPollArbitrum,
                    governance_portal: "https://vote.makerdao.com/polling/".to_string(),
                    decoder: json!({ "address_vote": "0x4f4e551b4920a5417F8d4e7f8f099660dAdadcEC", "proposalUrl": "https://vote.makerdao.com/polling/"}),
                    proposals_index: 0,
                    proposals_refresh_speed: 1_000_000,
                    votes_index: 0,
                    votes_refresh_speed: 1_000_000,
                },
            ],
        },
        DaoSeedData {
            name: "Balancer".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/balancer".to_string(),
                background_color: "#747474".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/balancer.eth".to_string(),
                decoder: json!({"snapshot_space": "balancer.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Element".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/element-dao".to_string(),
                background_color: "#6f7d83".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/elfi.eth".to_string(),
                decoder: json!({"snapshot_space": "elfi.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "1inch".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/1inch".to_string(),
                background_color: "#646573".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/1inch.eth".to_string(),
                decoder: json!({"snapshot_space": "1inch.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "SafeDAO".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/safedao".to_string(),
                background_color: "#737375".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/safe.eth".to_string(),
                decoder: json!({"snapshot_space": "safe.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Synthetix".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/synthetix".to_string(),
                background_color: "#0d506b".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/snxgov.eth".to_string(),
                decoder: json!({"snapshot_space": "snxgov.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "FWB".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/friends-with-benefits".to_string(),
                background_color: "#5a5a5a".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/friendswithbenefits.eth".to_string(),
                decoder: json!({"snapshot_space": "friendswithbenefits.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "GnosisDAO".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/gnosis".to_string(),
                background_color: "#7b837f".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/gnosis.eth".to_string(),
                decoder: json!({"snapshot_space": "gnosis.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Index Coop".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/index-coop".to_string(),
                background_color: "#797979".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/index-coop.eth".to_string(),
                decoder: json!({"snapshot_space": "index-coop.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Paladin".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/paladin".to_string(),
                background_color: "#86411c".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/palvote.eth".to_string(),
                decoder: json!({"snapshot_space": "palvote.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Sushi".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/sushiswap".to_string(),
                background_color: "#7e6c7c".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/sushigov.eth".to_string(),
                decoder: json!({"snapshot_space": "sushigov.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Instadapp".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/instadapp".to_string(),
                background_color: "#8fa6ff".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/instadapp-gov.eth".to_string(),
                decoder: json!({"snapshot_space": "instadapp-gov.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Gearbox".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/gearbox".to_string(),
                background_color: "#735462".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/gearbox.eth".to_string(),
                decoder: json!({"snapshot_space": "gearbox.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Euler".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/euler".to_string(),
                background_color: "#4d4641".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/eulerdao.eth".to_string(),
                decoder: json!({"snapshot_space": "eulerdao.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Aura Finance".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/aura-finance".to_string(),
                background_color: "#9166ef".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/aurafinance.eth".to_string(),
                decoder: json!({"snapshot_space": "aurafinance.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Developer DAO".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/developer-dao".to_string(),
                background_color: "#484848".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/devdao.eth".to_string(),
                decoder: json!({"snapshot_space": "devdao.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "APWine".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/apwine".to_string(),
                background_color: "#d5d9fa".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/apwine.eth".to_string(),
                decoder: json!({"snapshot_space": "apwine.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Morpho".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/morpho".to_string(),
                background_color: "#546275".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/morpho.eth".to_string(),
                decoder: json!({"snapshot_space": "morpho.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Lido DAO".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/lido".to_string(),
                background_color: "#f8afa3".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/lido-snapshot.eth".to_string(),
                decoder: json!({"snapshot_space": "lido-snapshot.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Starknet".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/starknet".to_string(),
                background_color: "#635672".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/starknet.eth".to_string(),
                decoder: json!({"snapshot_space": "starknet.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "dOrg".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/dOrg".to_string(),
                background_color: "#382b22".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/dorg.eth".to_string(),
                decoder: json!({"snapshot_space": "dorg.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Solace DAO".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/solace-dao".to_string(),
                background_color: "#3a3632".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/solace-dao.eth".to_string(),
                decoder: json!({"snapshot_space": "solace-dao.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
        DaoSeedData {
            name: "Rocket Pool".to_string(),
            settings: SettingsData {
                picture: "assets/project-logos/rocket-pool".to_string(),
                background_color: "#382b2f790702".to_string(),
            },
            handlers: vec![HandlerData {
                handler_type: HandlerType::Snapshot,
                governance_portal: "https://snapshot.org/#/rocketpool-dao.eth".to_string(),
                decoder: json!({"snapshot_space": "rocketpool-dao.eth"}),
                proposals_index: 0,
                proposals_refresh_speed: 1000,
                votes_index: 0,
                votes_refresh_speed: 0,
            }],
        },
    ]
}
