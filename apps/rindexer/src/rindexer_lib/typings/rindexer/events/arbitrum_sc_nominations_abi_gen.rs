pub use rindexer_arbitrum_sc_nominations_gen::*;
/// This module was auto-generated with ethers-rs Abigen.
/// More information at: <https://github.com/gakonst/ethers-rs>
#[allow(
    clippy::enum_variant_names,
    clippy::too_many_arguments,
    clippy::upper_case_acronyms,
    clippy::type_complexity,
    dead_code,
    non_camel_case_types
)]
pub mod rindexer_arbitrum_sc_nominations_gen {
    #[allow(deprecated)]
    fn __abi() -> ::ethers::core::abi::Abi {
        ::ethers::core::abi::ethabi::Contract {
            constructor: ::core::option::Option::Some(::ethers::core::abi::ethabi::Constructor {
                inputs: ::std::vec![],
            }),
            functions: ::core::convert::From::from([
                (
                    ::std::borrow::ToOwned::to_owned("BALLOT_TYPEHASH"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("BALLOT_TYPEHASH"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(32usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes32"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("COUNTING_MODE"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("COUNTING_MODE"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::String,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("string"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::Pure,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("EXCLUDE_ADDRESS"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("EXCLUDE_ADDRESS"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("EXTENDED_BALLOT_TYPEHASH"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("EXTENDED_BALLOT_TYPEHASH",),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(32usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes32"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("addContender"),
                    ::std::vec![
                        ::ethers::core::abi::ethabi::Function {
                            name: ::std::borrow::ToOwned::to_owned("addContender"),
                            inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },],
                            outputs: ::std::vec![],
                            constant: ::core::option::Option::None,
                            state_mutability: ::ethers::core::abi::ethabi::StateMutability::Pure,
                        },
                        ::ethers::core::abi::ethabi::Function {
                            name: ::std::borrow::ToOwned::to_owned("addContender"),
                            inputs: ::std::vec![
                                ::ethers::core::abi::ethabi::Param {
                                    name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                    kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                    internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                                },
                                ::ethers::core::abi::ethabi::Param {
                                    name: ::std::borrow::ToOwned::to_owned("signature"),
                                    kind: ::ethers::core::abi::ethabi::ParamType::Bytes,
                                    internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes"),),
                                },
                            ],
                            outputs: ::std::vec![],
                            constant: ::core::option::Option::None,
                            state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                        },
                    ],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("castVote"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("castVote"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint8"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("castVoteBySig"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("castVoteBySig"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint8"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint8"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(32usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes32"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(32usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes32"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("castVoteWithReason"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("castVoteWithReason"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint8"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::String,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("string"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("castVoteWithReasonAndParams"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("castVoteWithReasonAndParams",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("support"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint8"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("reason"),
                                kind: ::ethers::core::abi::ethabi::ParamType::String,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("string"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("params"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Bytes,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("castVoteWithReasonAndParamsBySig"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("castVoteWithReasonAndParamsBySig",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("support"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint8"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("reason"),
                                kind: ::ethers::core::abi::ethabi::ParamType::String,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("string"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("params"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Bytes,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("v"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint8"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("r"),
                                kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(32usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes32"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("s"),
                                kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(32usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes32"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("compliantNomineeCount"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("compliantNomineeCount",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("compliantNominees"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("compliantNominees"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                ::ethers::core::abi::ethabi::ParamType::Address,
                            ),),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address[]"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("createElection"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("createElection"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("currentCohort"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("currentCohort"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("enum Cohort"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("electionCount"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("electionCount"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("electionIndexToCohort"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("electionIndexToCohort",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("electionIndex"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("enum Cohort"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::Pure,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("electionIndexToDescription"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("electionIndexToDescription",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("electionIndex"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::String,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("string"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::Pure,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("electionToTimestamp"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("electionToTimestamp",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("electionIndex"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("excludeNominee"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("excludeNominee"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("nominee"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                        ],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("excludedNomineeCount"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("excludedNomineeCount",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("execute"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("execute"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("targets"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Address,
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("values"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("calldatas"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Bytes,
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("descriptionHash"),
                                kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(32usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes32"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::Payable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("firstNominationStartDate"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("firstNominationStartDate",),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("year"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("month"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("day"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("hour"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("getPastCirculatingSupply"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("getPastCirculatingSupply",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("blockNumber"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("getProposeArgs"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("getProposeArgs"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("electionIndex"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Address,
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Bytes,
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::String,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("string"),),
                            },
                        ],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::Pure,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("getVotes"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("getVotes"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("account"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("blockNumber"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("getVotesWithParams"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("getVotesWithParams"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("account"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("blockNumber"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("params"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Bytes,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("hasVoted"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("hasVoted"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("account"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Bool,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bool"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("hashProposal"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("hashProposal"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("targets"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Address,
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("values"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("calldatas"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Bytes,
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("descriptionHash"),
                                kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(32usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes32"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::Pure,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("includeNominee"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("includeNominee"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("account"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                        ],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("initialize"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("initialize"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("params"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Tuple(::std::vec![
                                ::ethers::core::abi::ethabi::ParamType::Tuple(::std::vec![
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                ],),
                                ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                ::ethers::core::abi::ethabi::ParamType::Address,
                                ::ethers::core::abi::ethabi::ParamType::Address,
                                ::ethers::core::abi::ethabi::ParamType::Address,
                                ::ethers::core::abi::ethabi::ParamType::Address,
                                ::ethers::core::abi::ethabi::ParamType::Address,
                                ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                            ],),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned(
                                "struct SecurityCouncilNomineeElectionGovernor.InitParams",
                            ),),
                        },],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("isCompliantNominee"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("isCompliantNominee"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("account"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Bool,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bool"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("isContender"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("isContender"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("possibleContender"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Bool,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bool"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("isExcluded"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("isExcluded"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("possibleExcluded"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Bool,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bool"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("isNominee"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("isNominee"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("contender"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Bool,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bool"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("name"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("name"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::String,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("string"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("nomineeCount"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("nomineeCount"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("nomineeVetter"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("nomineeVetter"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("nomineeVettingDuration"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("nomineeVettingDuration",),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("nominees"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("nominees"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                ::ethers::core::abi::ethabi::ParamType::Address,
                            ),),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address[]"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("onERC1155BatchReceived"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("onERC1155BatchReceived",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Bytes,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(4usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes4"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("onERC1155Received"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("onERC1155Received"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Bytes,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(4usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes4"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("onERC721Received"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("onERC721Received"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Bytes,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(4usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes4"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("otherCohort"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("otherCohort"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("enum Cohort"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("owner"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("owner"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("proposalDeadline"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("proposalDeadline"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("proposalSnapshot"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("proposalSnapshot"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("proposalThreshold"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("proposalThreshold"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("proposalVettingDeadline"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("proposalVettingDeadline",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("propose"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("propose"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Address,
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Bytes,
                                ),),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes[]"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::String,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("string"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("quorum"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("quorum"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("blockNumber"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("quorumDenominator"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("quorumDenominator"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::Pure,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("quorumNumerator"),
                    ::std::vec![
                        ::ethers::core::abi::ethabi::Function {
                            name: ::std::borrow::ToOwned::to_owned("quorumNumerator"),
                            inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("blockNumber"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },],
                            outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },],
                            constant: ::core::option::Option::None,
                            state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                        },
                        ::ethers::core::abi::ethabi::Function {
                            name: ::std::borrow::ToOwned::to_owned("quorumNumerator"),
                            inputs: ::std::vec![],
                            outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                                name: ::std::string::String::new(),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },],
                            constant: ::core::option::Option::None,
                            state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                        },
                    ],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("recoverAddContenderMessage"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("recoverAddContenderMessage",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("signature"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Bytes,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("relay"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("relay"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("target"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("value"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("data"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Bytes,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes"),),
                            },
                        ],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("renounceOwnership"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("renounceOwnership"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("securityCouncilManager"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("securityCouncilManager",),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned(
                                "contract ISecurityCouncilManager",
                            ),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("securityCouncilMemberElectionGovernor"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("securityCouncilMemberElectionGovernor",),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned(
                                "contract ISecurityCouncilMemberElectionGovernor",
                            ),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("setNomineeVetter"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("setNomineeVetter"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("_nomineeVetter"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("setProposalThreshold"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("setProposalThreshold",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("newProposalThreshold",),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("setVotingDelay"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("setVotingDelay"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("newVotingDelay"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("setVotingPeriod"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("setVotingPeriod"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("newVotingPeriod"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("state"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("state"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned(
                                "enum IGovernorUpgradeable.ProposalState",
                            ),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("supportsInterface"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("supportsInterface"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("interfaceId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(4usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes4"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Bool,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bool"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("token"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("token"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned(
                                "contract IVotesUpgradeable",
                            ),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("transferOwnership"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("transferOwnership"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("newOwner"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("updateQuorumNumerator"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("updateQuorumNumerator",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("newQuorumNumerator",),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("usedNonces"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("usedNonces"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(32usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes32"),),
                        },],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Bool,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bool"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("version"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("version"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::String,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("string"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("votesReceived"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("votesReceived"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("contender"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("votesUsed"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("votesUsed"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("account"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                        ],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("votingDelay"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("votingDelay"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("votingPeriod"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("votingPeriod"),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::View,
                    },],
                ),
            ]),
            events: ::core::convert::From::from([
                (
                    ::std::borrow::ToOwned::to_owned("ContenderAdded"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("ContenderAdded"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("contender"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("Initialized"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("Initialized"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::EventParam {
                            name: ::std::borrow::ToOwned::to_owned("version"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                            indexed: false,
                        },],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("NewNominee"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("NewNominee"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("nominee"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("NomineeExcluded"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("NomineeExcluded"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("nominee"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("NomineeVetterChanged"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("NomineeVetterChanged",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("oldNomineeVetter"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("newNomineeVetter"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("OwnershipTransferred"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("OwnershipTransferred",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("previousOwner"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("newOwner"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposalCanceled"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("ProposalCanceled"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::EventParam {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            indexed: false,
                        },],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposalCreated"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("ProposalCreated"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("proposer"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("targets"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Address,
                                ),),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("values"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Uint(256usize),
                                ),),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("signatures"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::String,
                                ),),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("calldatas"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Array(::std::boxed::Box::new(
                                    ::ethers::core::abi::ethabi::ParamType::Bytes,
                                ),),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("startBlock"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("endBlock"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("description"),
                                kind: ::ethers::core::abi::ethabi::ParamType::String,
                                indexed: false,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposalExecuted"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("ProposalExecuted"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::EventParam {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            indexed: false,
                        },],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposalThresholdSet"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("ProposalThresholdSet",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("oldProposalThreshold",),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("newProposalThreshold",),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("QuorumNumeratorUpdated"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("QuorumNumeratorUpdated",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("oldQuorumNumerator",),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("newQuorumNumerator",),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("VoteCast"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("VoteCast"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("voter"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("support"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("weight"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("reason"),
                                kind: ::ethers::core::abi::ethabi::ParamType::String,
                                indexed: false,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("VoteCastForContender"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("VoteCastForContender",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("voter"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("contender"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("votes"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("totalUsedVotes"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("usableVotes"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("VoteCastWithParams"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("VoteCastWithParams"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("voter"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("support"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("weight"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("reason"),
                                kind: ::ethers::core::abi::ethabi::ParamType::String,
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("params"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Bytes,
                                indexed: false,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("VotingDelaySet"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("VotingDelaySet"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("oldVotingDelay"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("newVotingDelay"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("VotingPeriodSet"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("VotingPeriodSet"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("oldVotingPeriod"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("newVotingPeriod"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
            ]),
            errors: ::core::convert::From::from([
                (
                    ::std::borrow::ToOwned::to_owned("AccountInOtherCohort"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("AccountInOtherCohort",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("cohort"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("enum Cohort"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("account"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("AlreadyContender"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("AlreadyContender"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("contender"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("CastVoteDisabled"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("CastVoteDisabled"),
                        inputs: ::std::vec![],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("CompliantNomineeTargetHit"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("CompliantNomineeTargetHit",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("nomineeCount"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("expectedCount"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("CreateTooEarly"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("CreateTooEarly"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("blockTimestamp"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("startTime"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("Deprecated"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("Deprecated"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("message"),
                            kind: ::ethers::core::abi::ethabi::ParamType::String,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("string"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("Empty"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("Empty"),
                        inputs: ::std::vec![],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("InsufficientCompliantNomineeCount"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("InsufficientCompliantNomineeCount",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("compliantNomineeCount",),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("expectedCount"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("InsufficientTokens"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("InsufficientTokens"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("votes"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("prevVotesUsed"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("weight"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("InvalidSignature"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("InvalidSignature"),
                        inputs: ::std::vec![],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("InvalidStartDate"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("InvalidStartDate"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("year"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("month"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("day"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("hour"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("InvalidSupport"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("InvalidSupport"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("support"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint8"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("LastMemberElectionNotExecuted"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("LastMemberElectionNotExecuted",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("prevProposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("NomineeAlreadyAdded"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("NomineeAlreadyAdded",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("nominee"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("NomineeAlreadyExcluded"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("NomineeAlreadyExcluded",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("nominee"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("NotAContract"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("NotAContract"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("account"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("NotEligibleContender"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("NotEligibleContender",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("contender"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("NotNominee"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("NotNominee"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("nominee"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("OnlyNomineeVetter"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("OnlyNomineeVetter"),
                        inputs: ::std::vec![],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposalIdMismatch"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("ProposalIdMismatch"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("nomineeProposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("memberProposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposalInVettingPeriod"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("ProposalInVettingPeriod",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("blockNumber"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("vettingDeadline"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposalNotInVettingPeriod"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("ProposalNotInVettingPeriod",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("blockNumber"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("vettingDeadline"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposalNotPending"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("ProposalNotPending"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("state"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned(
                                "enum IGovernorUpgradeable.ProposalState",
                            ),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposalNotSucceededState"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("ProposalNotSucceededState",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("state"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(8usize),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned(
                                "enum IGovernorUpgradeable.ProposalState",
                            ),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposeDisabled"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("ProposeDisabled"),
                        inputs: ::std::vec![],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("QuorumNumeratorTooLow"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("QuorumNumeratorTooLow",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("quorumNumeratorValue",),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("StartDateTooEarly"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("StartDateTooEarly"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("startTime"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("currentTime"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("UnexpectedParamsLength"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("UnexpectedParamsLength",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("paramLength"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("VoteAlreadyCast"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("VoteAlreadyCast"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("voter"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("replayHash"),
                                kind: ::ethers::core::abi::ethabi::ParamType::FixedBytes(32usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("bytes32"),),
                            },
                        ],
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ZeroAddress"),
                    ::std::vec![::ethers::core::abi::ethabi::AbiError {
                        name: ::std::borrow::ToOwned::to_owned("ZeroAddress"),
                        inputs: ::std::vec![],
                    },],
                ),
            ]),
            receive: true,
            fallback: false,
        }
    }
    ///The parsed JSON ABI of the contract.
    pub static RINDEXERARBITRUMSCNOMINATIONSGEN_ABI: ::ethers::contract::Lazy<::ethers::core::abi::Abi> = ::ethers::contract::Lazy::new(__abi);
    pub struct RindexerArbitrumSCNominationsGen<M>(::ethers::contract::Contract<M>);
    impl<M> ::core::clone::Clone for RindexerArbitrumSCNominationsGen<M> {
        fn clone(&self) -> Self {
            Self(::core::clone::Clone::clone(&self.0))
        }
    }
    impl<M> ::core::ops::Deref for RindexerArbitrumSCNominationsGen<M> {
        type Target = ::ethers::contract::Contract<M>;
        fn deref(&self) -> &Self::Target {
            &self.0
        }
    }
    impl<M> ::core::ops::DerefMut for RindexerArbitrumSCNominationsGen<M> {
        fn deref_mut(&mut self) -> &mut Self::Target {
            &mut self.0
        }
    }
    impl<M> ::core::fmt::Debug for RindexerArbitrumSCNominationsGen<M> {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
            f.debug_tuple(::core::stringify!(RindexerArbitrumSCNominationsGen))
                .field(&self.address())
                .finish()
        }
    }
    impl<M: ::ethers::providers::Middleware> RindexerArbitrumSCNominationsGen<M> {
        /// Creates a new contract instance with the specified `ethers` client at
        /// `address`. The contract derefs to a `ethers::Contract` object.
        pub fn new<T: Into<::ethers::core::types::Address>>(address: T, client: ::std::sync::Arc<M>) -> Self {
            Self(::ethers::contract::Contract::new(
                address.into(),
                RINDEXERARBITRUMSCNOMINATIONSGEN_ABI.clone(),
                client,
            ))
        }
        ///Calls the contract's `BALLOT_TYPEHASH` (0xdeaaa7cc) function
        pub fn ballot_typehash(&self) -> ::ethers::contract::builders::ContractCall<M, [u8; 32]> {
            self.0
                .method_hash([222, 170, 167, 204], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `COUNTING_MODE` (0xdd4e2ba5) function
        pub fn counting_mode(&self) -> ::ethers::contract::builders::ContractCall<M, ::std::string::String> {
            self.0
                .method_hash([221, 78, 43, 165], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `EXCLUDE_ADDRESS` (0x5e12ebbd) function
        pub fn exclude_address(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::Address> {
            self.0
                .method_hash([94, 18, 235, 189], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `EXTENDED_BALLOT_TYPEHASH` (0x2fe3e261) function
        pub fn extended_ballot_typehash(&self) -> ::ethers::contract::builders::ContractCall<M, [u8; 32]> {
            self.0
                .method_hash([47, 227, 226, 97], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `addContender` (0x140af012) function
        pub fn add_contender(&self, p0: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([20, 10, 240, 18], p0)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `addContender` (0xa8f38759) function
        pub fn add_contender_with_proposal_id(&self, proposal_id: ::ethers::core::types::U256, signature: ::ethers::core::types::Bytes) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([168, 243, 135, 89], (proposal_id, signature))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `castVote` (0x56781388) function
        pub fn cast_vote(&self, p0: ::ethers::core::types::U256, p1: u8) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([86, 120, 19, 136], (p0, p1))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `castVoteBySig` (0x3bccf4fd) function
        pub fn cast_vote_by_sig(&self, p0: ::ethers::core::types::U256, p1: u8, p2: u8, p3: [u8; 32], p4: [u8; 32]) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([59, 204, 244, 253], (p0, p1, p2, p3, p4))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `castVoteWithReason` (0x7b3c71d3) function
        pub fn cast_vote_with_reason(&self, p0: ::ethers::core::types::U256, p1: u8, p2: ::std::string::String) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([123, 60, 113, 211], (p0, p1, p2))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `castVoteWithReasonAndParams` (0x5f398a14) function
        pub fn cast_vote_with_reason_and_params(&self, proposal_id: ::ethers::core::types::U256, support: u8, reason: ::std::string::String, params: ::ethers::core::types::Bytes) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([95, 57, 138, 20], (proposal_id, support, reason, params))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `castVoteWithReasonAndParamsBySig` (0x03420181) function
        pub fn cast_vote_with_reason_and_params_by_sig(&self, proposal_id: ::ethers::core::types::U256, support: u8, reason: ::std::string::String, params: ::ethers::core::types::Bytes, v: u8, r: [u8; 32], s: [u8; 32]) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash(
                    [3, 66, 1, 129],
                    (proposal_id, support, reason, params, v, r, s),
                )
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `compliantNomineeCount` (0xe0c11ff6) function
        pub fn compliant_nominee_count(&self, proposal_id: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([224, 193, 31, 246], proposal_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `compliantNominees` (0xf3dfd61c) function
        pub fn compliant_nominees(&self, proposal_id: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::std::vec::Vec<::ethers::core::types::Address>> {
            self.0
                .method_hash([243, 223, 214, 28], proposal_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `createElection` (0x24c2286c) function
        pub fn create_election(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([36, 194, 40, 108], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `currentCohort` (0xe0f9c970) function
        pub fn current_cohort(&self) -> ::ethers::contract::builders::ContractCall<M, u8> {
            self.0
                .method_hash([224, 249, 201, 112], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `electionCount` (0x997d2830) function
        pub fn election_count(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([153, 125, 40, 48], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `electionIndexToCohort` (0x33bb6f4b) function
        pub fn election_index_to_cohort(&self, election_index: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, u8> {
            self.0
                .method_hash([51, 187, 111, 75], election_index)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `electionIndexToDescription` (0x276ae91a) function
        pub fn election_index_to_description(&self, election_index: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::std::string::String> {
            self.0
                .method_hash([39, 106, 233, 26], election_index)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `electionToTimestamp` (0xc2192dc1) function
        pub fn election_to_timestamp(&self, election_index: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([194, 25, 45, 193], election_index)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `excludeNominee` (0xe97ada39) function
        pub fn exclude_nominee(&self, proposal_id: ::ethers::core::types::U256, nominee: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([233, 122, 218, 57], (proposal_id, nominee))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `excludedNomineeCount` (0xb0ee63f2) function
        pub fn excluded_nominee_count(&self, proposal_id: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([176, 238, 99, 242], proposal_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `execute` (0x2656227d) function
        pub fn execute(&self, targets: ::std::vec::Vec<::ethers::core::types::Address>, values: ::std::vec::Vec<::ethers::core::types::U256>, calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>, description_hash: [u8; 32]) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash(
                    [38, 86, 34, 125],
                    (targets, values, calldatas, description_hash),
                )
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `firstNominationStartDate` (0xbeb28536) function
        pub fn first_nomination_start_date(
            &self,
        ) -> ::ethers::contract::builders::ContractCall<
            M,
            (
                ::ethers::core::types::U256,
                ::ethers::core::types::U256,
                ::ethers::core::types::U256,
                ::ethers::core::types::U256,
            ),
        > {
            self.0
                .method_hash([190, 178, 133, 54], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `getPastCirculatingSupply` (0x6e462680) function
        pub fn get_past_circulating_supply(&self, block_number: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([110, 70, 38, 128], block_number)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `getProposeArgs` (0x1f0ac182) function
        pub fn get_propose_args(
            &self,
            election_index: ::ethers::core::types::U256,
        ) -> ::ethers::contract::builders::ContractCall<
            M,
            (
                ::std::vec::Vec<::ethers::core::types::Address>,
                ::std::vec::Vec<::ethers::core::types::U256>,
                ::std::vec::Vec<::ethers::core::types::Bytes>,
                ::std::string::String,
            ),
        > {
            self.0
                .method_hash([31, 10, 193, 130], election_index)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `getVotes` (0xeb9019d4) function
        pub fn get_votes(&self, account: ::ethers::core::types::Address, block_number: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([235, 144, 25, 212], (account, block_number))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `getVotesWithParams` (0x9a802a6d) function
        pub fn get_votes_with_params(&self, account: ::ethers::core::types::Address, block_number: ::ethers::core::types::U256, params: ::ethers::core::types::Bytes) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([154, 128, 42, 109], (account, block_number, params))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `hasVoted` (0x43859632) function
        pub fn has_voted(&self, proposal_id: ::ethers::core::types::U256, account: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, bool> {
            self.0
                .method_hash([67, 133, 150, 50], (proposal_id, account))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `hashProposal` (0xc59057e4) function
        pub fn hash_proposal(&self, targets: ::std::vec::Vec<::ethers::core::types::Address>, values: ::std::vec::Vec<::ethers::core::types::U256>, calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>, description_hash: [u8; 32]) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash(
                    [197, 144, 87, 228],
                    (targets, values, calldatas, description_hash),
                )
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `includeNominee` (0x35334628) function
        pub fn include_nominee(&self, proposal_id: ::ethers::core::types::U256, account: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([53, 51, 70, 40], (proposal_id, account))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `initialize` (0x40e8c5cb) function
        pub fn initialize(&self, params: InitParams) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([64, 232, 197, 203], (params,))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `isCompliantNominee` (0xc16e0ec6) function
        pub fn is_compliant_nominee(&self, proposal_id: ::ethers::core::types::U256, account: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, bool> {
            self.0
                .method_hash([193, 110, 14, 198], (proposal_id, account))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `isContender` (0xeba4b237) function
        pub fn is_contender(&self, proposal_id: ::ethers::core::types::U256, possible_contender: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, bool> {
            self.0
                .method_hash([235, 164, 178, 55], (proposal_id, possible_contender))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `isExcluded` (0x3b158390) function
        pub fn is_excluded(&self, proposal_id: ::ethers::core::types::U256, possible_excluded: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, bool> {
            self.0
                .method_hash([59, 21, 131, 144], (proposal_id, possible_excluded))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `isNominee` (0x7d60af91) function
        pub fn is_nominee(&self, proposal_id: ::ethers::core::types::U256, contender: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, bool> {
            self.0
                .method_hash([125, 96, 175, 145], (proposal_id, contender))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `name` (0x06fdde03) function
        pub fn name(&self) -> ::ethers::contract::builders::ContractCall<M, ::std::string::String> {
            self.0
                .method_hash([6, 253, 222, 3], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `nomineeCount` (0xe63f88a8) function
        pub fn nominee_count(&self, proposal_id: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([230, 63, 136, 168], proposal_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `nomineeVetter` (0x0298ad49) function
        pub fn nominee_vetter(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::Address> {
            self.0
                .method_hash([2, 152, 173, 73], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `nomineeVettingDuration` (0x45110965) function
        pub fn nominee_vetting_duration(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([69, 17, 9, 101], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `nominees` (0xeec6b91e) function
        pub fn nominees(&self, proposal_id: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::std::vec::Vec<::ethers::core::types::Address>> {
            self.0
                .method_hash([238, 198, 185, 30], proposal_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `onERC1155BatchReceived` (0xbc197c81) function
        pub fn on_erc1155_batch_received(&self, p0: ::ethers::core::types::Address, p1: ::ethers::core::types::Address, p2: ::std::vec::Vec<::ethers::core::types::U256>, p3: ::std::vec::Vec<::ethers::core::types::U256>, p4: ::ethers::core::types::Bytes) -> ::ethers::contract::builders::ContractCall<M, [u8; 4]> {
            self.0
                .method_hash([188, 25, 124, 129], (p0, p1, p2, p3, p4))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `onERC1155Received` (0xf23a6e61) function
        pub fn on_erc1155_received(&self, p0: ::ethers::core::types::Address, p1: ::ethers::core::types::Address, p2: ::ethers::core::types::U256, p3: ::ethers::core::types::U256, p4: ::ethers::core::types::Bytes) -> ::ethers::contract::builders::ContractCall<M, [u8; 4]> {
            self.0
                .method_hash([242, 58, 110, 97], (p0, p1, p2, p3, p4))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `onERC721Received` (0x150b7a02) function
        pub fn on_erc721_received(&self, p0: ::ethers::core::types::Address, p1: ::ethers::core::types::Address, p2: ::ethers::core::types::U256, p3: ::ethers::core::types::Bytes) -> ::ethers::contract::builders::ContractCall<M, [u8; 4]> {
            self.0
                .method_hash([21, 11, 122, 2], (p0, p1, p2, p3))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `otherCohort` (0xcf5d27c4) function
        pub fn other_cohort(&self) -> ::ethers::contract::builders::ContractCall<M, u8> {
            self.0
                .method_hash([207, 93, 39, 196], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `owner` (0x8da5cb5b) function
        pub fn owner(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::Address> {
            self.0
                .method_hash([141, 165, 203, 91], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `proposalDeadline` (0xc01f9e37) function
        pub fn proposal_deadline(&self, proposal_id: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([192, 31, 158, 55], proposal_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `proposalSnapshot` (0x2d63f693) function
        pub fn proposal_snapshot(&self, proposal_id: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([45, 99, 246, 147], proposal_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `proposalThreshold` (0xb58131b0) function
        pub fn proposal_threshold(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([181, 129, 49, 176], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `proposalVettingDeadline` (0x2df2c649) function
        pub fn proposal_vetting_deadline(&self, proposal_id: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([45, 242, 198, 73], proposal_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `propose` (0x7d5e81e2) function
        pub fn propose(&self, p0: ::std::vec::Vec<::ethers::core::types::Address>, p1: ::std::vec::Vec<::ethers::core::types::U256>, p2: ::std::vec::Vec<::ethers::core::types::Bytes>, p3: ::std::string::String) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([125, 94, 129, 226], (p0, p1, p2, p3))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `quorum` (0xf8ce560a) function
        pub fn quorum(&self, block_number: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([248, 206, 86, 10], block_number)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `quorumDenominator` (0x97c3d334) function
        pub fn quorum_denominator(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([151, 195, 211, 52], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `quorumNumerator` (0x60c4247f) function
        pub fn quorum_numerator_with_block_number(&self, block_number: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([96, 196, 36, 127], block_number)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `quorumNumerator` (0xa7713a70) function
        pub fn quorum_numerator(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([167, 113, 58, 112], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `recoverAddContenderMessage` (0x5a756eaf) function
        pub fn recover_add_contender_message(&self, proposal_id: ::ethers::core::types::U256, signature: ::ethers::core::types::Bytes) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::Address> {
            self.0
                .method_hash([90, 117, 110, 175], (proposal_id, signature))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `relay` (0xc28bc2fa) function
        pub fn relay(&self, target: ::ethers::core::types::Address, value: ::ethers::core::types::U256, data: ::ethers::core::types::Bytes) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([194, 139, 194, 250], (target, value, data))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `renounceOwnership` (0x715018a6) function
        pub fn renounce_ownership(&self) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([113, 80, 24, 166], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `securityCouncilManager` (0x03d1ce8a) function
        pub fn security_council_manager(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::Address> {
            self.0
                .method_hash([3, 209, 206, 138], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `securityCouncilMemberElectionGovernor` (0x1b6a7673) function
        pub fn security_council_member_election_governor(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::Address> {
            self.0
                .method_hash([27, 106, 118, 115], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `setNomineeVetter` (0xae8acb5e) function
        pub fn set_nominee_vetter(&self, nominee_vetter: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([174, 138, 203, 94], nominee_vetter)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `setProposalThreshold` (0xece40cc1) function
        pub fn set_proposal_threshold(&self, new_proposal_threshold: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([236, 228, 12, 193], new_proposal_threshold)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `setVotingDelay` (0x70b0f660) function
        pub fn set_voting_delay(&self, new_voting_delay: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([112, 176, 246, 96], new_voting_delay)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `setVotingPeriod` (0xea0217cf) function
        pub fn set_voting_period(&self, new_voting_period: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([234, 2, 23, 207], new_voting_period)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `state` (0x3e4f49e6) function
        pub fn state(&self, proposal_id: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, u8> {
            self.0
                .method_hash([62, 79, 73, 230], proposal_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `supportsInterface` (0x01ffc9a7) function
        pub fn supports_interface(&self, interface_id: [u8; 4]) -> ::ethers::contract::builders::ContractCall<M, bool> {
            self.0
                .method_hash([1, 255, 201, 167], interface_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `token` (0xfc0c546a) function
        pub fn token(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::Address> {
            self.0
                .method_hash([252, 12, 84, 106], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `transferOwnership` (0xf2fde38b) function
        pub fn transfer_ownership(&self, new_owner: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([242, 253, 227, 139], new_owner)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `updateQuorumNumerator` (0x06f3f9e6) function
        pub fn update_quorum_numerator(&self, new_quorum_numerator: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([6, 243, 249, 230], new_quorum_numerator)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `usedNonces` (0xfeb61724) function
        pub fn used_nonces(&self, p0: [u8; 32]) -> ::ethers::contract::builders::ContractCall<M, bool> {
            self.0
                .method_hash([254, 182, 23, 36], p0)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `version` (0x54fd4d50) function
        pub fn version(&self) -> ::ethers::contract::builders::ContractCall<M, ::std::string::String> {
            self.0
                .method_hash([84, 253, 77, 80], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `votesReceived` (0x33dd6bed) function
        pub fn votes_received(&self, proposal_id: ::ethers::core::types::U256, contender: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([51, 221, 107, 237], (proposal_id, contender))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `votesUsed` (0x9523730e) function
        pub fn votes_used(&self, proposal_id: ::ethers::core::types::U256, account: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([149, 35, 115, 14], (proposal_id, account))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `votingDelay` (0x3932abb1) function
        pub fn voting_delay(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([57, 50, 171, 177], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `votingPeriod` (0x02a251a3) function
        pub fn voting_period(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([2, 162, 81, 163], ())
                .expect("method not found (this should never happen)")
        }
        ///Gets the contract's `ContenderAdded` event
        pub fn contender_added_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, ContenderAddedFilter> {
            self.0.event()
        }
        ///Gets the contract's `Initialized` event
        pub fn initialized_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, InitializedFilter> {
            self.0.event()
        }
        ///Gets the contract's `NewNominee` event
        pub fn new_nominee_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, NewNomineeFilter> {
            self.0.event()
        }
        ///Gets the contract's `NomineeExcluded` event
        pub fn nominee_excluded_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, NomineeExcludedFilter> {
            self.0.event()
        }
        ///Gets the contract's `NomineeVetterChanged` event
        pub fn nominee_vetter_changed_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, NomineeVetterChangedFilter> {
            self.0.event()
        }
        ///Gets the contract's `OwnershipTransferred` event
        pub fn ownership_transferred_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, OwnershipTransferredFilter> {
            self.0.event()
        }
        ///Gets the contract's `ProposalCanceled` event
        pub fn proposal_canceled_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, ProposalCanceledFilter> {
            self.0.event()
        }
        ///Gets the contract's `ProposalCreated` event
        pub fn proposal_created_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, ProposalCreatedFilter> {
            self.0.event()
        }
        ///Gets the contract's `ProposalExecuted` event
        pub fn proposal_executed_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, ProposalExecutedFilter> {
            self.0.event()
        }
        ///Gets the contract's `ProposalThresholdSet` event
        pub fn proposal_threshold_set_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, ProposalThresholdSetFilter> {
            self.0.event()
        }
        ///Gets the contract's `QuorumNumeratorUpdated` event
        pub fn quorum_numerator_updated_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, QuorumNumeratorUpdatedFilter> {
            self.0.event()
        }
        ///Gets the contract's `VoteCast` event
        pub fn vote_cast_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, VoteCastFilter> {
            self.0.event()
        }
        ///Gets the contract's `VoteCastForContender` event
        pub fn vote_cast_for_contender_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, VoteCastForContenderFilter> {
            self.0.event()
        }
        ///Gets the contract's `VoteCastWithParams` event
        pub fn vote_cast_with_params_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, VoteCastWithParamsFilter> {
            self.0.event()
        }
        ///Gets the contract's `VotingDelaySet` event
        pub fn voting_delay_set_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, VotingDelaySetFilter> {
            self.0.event()
        }
        ///Gets the contract's `VotingPeriodSet` event
        pub fn voting_period_set_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, VotingPeriodSetFilter> {
            self.0.event()
        }
        /// Returns an `Event` builder for all the events of this contract.
        pub fn events(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, RindexerArbitrumSCNominationsGenEvents> {
            self.0
                .event_with_filter(::core::default::Default::default())
        }
    }
    impl<M: ::ethers::providers::Middleware> From<::ethers::contract::Contract<M>> for RindexerArbitrumSCNominationsGen<M> {
        fn from(contract: ::ethers::contract::Contract<M>) -> Self {
            Self::new(contract.address(), contract.client())
        }
    }
    ///Custom Error type `AccountInOtherCohort` with signature `AccountInOtherCohort(uint8,address)` and selector `0xc6cd9b06`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "AccountInOtherCohort",
        abi = "AccountInOtherCohort(uint8,address)"
    )]
    pub struct AccountInOtherCohort {
        pub cohort: u8,
        pub account: ::ethers::core::types::Address,
    }
    ///Custom Error type `AlreadyContender` with signature `AlreadyContender(address)` and selector `0x6de08710`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "AlreadyContender", abi = "AlreadyContender(address)")]
    pub struct AlreadyContender {
        pub contender: ::ethers::core::types::Address,
    }
    ///Custom Error type `CastVoteDisabled` with signature `CastVoteDisabled()` and selector `0x4009353f`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "CastVoteDisabled", abi = "CastVoteDisabled()")]
    pub struct CastVoteDisabled;
    ///Custom Error type `CompliantNomineeTargetHit` with signature `CompliantNomineeTargetHit(uint256,uint256)` and selector `0x7380e239`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "CompliantNomineeTargetHit",
        abi = "CompliantNomineeTargetHit(uint256,uint256)"
    )]
    pub struct CompliantNomineeTargetHit {
        pub nominee_count: ::ethers::core::types::U256,
        pub expected_count: ::ethers::core::types::U256,
    }
    ///Custom Error type `CreateTooEarly` with signature `CreateTooEarly(uint256,uint256)` and selector `0x25446e50`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "CreateTooEarly", abi = "CreateTooEarly(uint256,uint256)")]
    pub struct CreateTooEarly {
        pub block_timestamp: ::ethers::core::types::U256,
        pub start_time: ::ethers::core::types::U256,
    }
    ///Custom Error type `Deprecated` with signature `Deprecated(string)` and selector `0xff4d2593`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "Deprecated", abi = "Deprecated(string)")]
    pub struct Deprecated {
        pub message: ::std::string::String,
    }
    ///Custom Error type `Empty` with signature `Empty()` and selector `0x3db2a12a`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "Empty", abi = "Empty()")]
    pub struct Empty;
    ///Custom Error type `InsufficientCompliantNomineeCount` with signature `InsufficientCompliantNomineeCount(uint256,uint256)` and selector `0xaa5f24ef`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "InsufficientCompliantNomineeCount",
        abi = "InsufficientCompliantNomineeCount(uint256,uint256)"
    )]
    pub struct InsufficientCompliantNomineeCount {
        pub compliant_nominee_count: ::ethers::core::types::U256,
        pub expected_count: ::ethers::core::types::U256,
    }
    ///Custom Error type `InsufficientTokens` with signature `InsufficientTokens(uint256,uint256,uint256)` and selector `0x1aefbf9e`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "InsufficientTokens",
        abi = "InsufficientTokens(uint256,uint256,uint256)"
    )]
    pub struct InsufficientTokens {
        pub votes: ::ethers::core::types::U256,
        pub prev_votes_used: ::ethers::core::types::U256,
        pub weight: ::ethers::core::types::U256,
    }
    ///Custom Error type `InvalidSignature` with signature `InvalidSignature()` and selector `0x8baa579f`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "InvalidSignature", abi = "InvalidSignature()")]
    pub struct InvalidSignature;
    ///Custom Error type `InvalidStartDate` with signature `InvalidStartDate(uint256,uint256,uint256,uint256)` and selector `0xe687588b`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "InvalidStartDate",
        abi = "InvalidStartDate(uint256,uint256,uint256,uint256)"
    )]
    pub struct InvalidStartDate {
        pub year: ::ethers::core::types::U256,
        pub month: ::ethers::core::types::U256,
        pub day: ::ethers::core::types::U256,
        pub hour: ::ethers::core::types::U256,
    }
    ///Custom Error type `InvalidSupport` with signature `InvalidSupport(uint8)` and selector `0xfe0e5d8b`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "InvalidSupport", abi = "InvalidSupport(uint8)")]
    pub struct InvalidSupport {
        pub support: u8,
    }
    ///Custom Error type `LastMemberElectionNotExecuted` with signature `LastMemberElectionNotExecuted(uint256)` and selector `0xebf0cac1`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "LastMemberElectionNotExecuted",
        abi = "LastMemberElectionNotExecuted(uint256)"
    )]
    pub struct LastMemberElectionNotExecuted {
        pub prev_proposal_id: ::ethers::core::types::U256,
    }
    ///Custom Error type `NomineeAlreadyAdded` with signature `NomineeAlreadyAdded(address)` and selector `0xc4cffe23`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "NomineeAlreadyAdded", abi = "NomineeAlreadyAdded(address)")]
    pub struct NomineeAlreadyAdded {
        pub nominee: ::ethers::core::types::Address,
    }
    ///Custom Error type `NomineeAlreadyExcluded` with signature `NomineeAlreadyExcluded(address)` and selector `0x19c5763c`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "NomineeAlreadyExcluded",
        abi = "NomineeAlreadyExcluded(address)"
    )]
    pub struct NomineeAlreadyExcluded {
        pub nominee: ::ethers::core::types::Address,
    }
    ///Custom Error type `NotAContract` with signature `NotAContract(address)` and selector `0x8a8b41ec`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "NotAContract", abi = "NotAContract(address)")]
    pub struct NotAContract {
        pub account: ::ethers::core::types::Address,
    }
    ///Custom Error type `NotEligibleContender` with signature `NotEligibleContender(address)` and selector `0xa5c0125d`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "NotEligibleContender", abi = "NotEligibleContender(address)")]
    pub struct NotEligibleContender {
        pub contender: ::ethers::core::types::Address,
    }
    ///Custom Error type `NotNominee` with signature `NotNominee(address)` and selector `0xaa717320`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "NotNominee", abi = "NotNominee(address)")]
    pub struct NotNominee {
        pub nominee: ::ethers::core::types::Address,
    }
    ///Custom Error type `OnlyNomineeVetter` with signature `OnlyNomineeVetter()` and selector `0x23f283d2`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "OnlyNomineeVetter", abi = "OnlyNomineeVetter()")]
    pub struct OnlyNomineeVetter;
    ///Custom Error type `ProposalIdMismatch` with signature `ProposalIdMismatch(uint256,uint256)` and selector `0x01eef61a`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "ProposalIdMismatch",
        abi = "ProposalIdMismatch(uint256,uint256)"
    )]
    pub struct ProposalIdMismatch {
        pub nominee_proposal_id: ::ethers::core::types::U256,
        pub member_proposal_id: ::ethers::core::types::U256,
    }
    ///Custom Error type `ProposalInVettingPeriod` with signature `ProposalInVettingPeriod(uint256,uint256)` and selector `0x992f5645`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "ProposalInVettingPeriod",
        abi = "ProposalInVettingPeriod(uint256,uint256)"
    )]
    pub struct ProposalInVettingPeriod {
        pub block_number: ::ethers::core::types::U256,
        pub vetting_deadline: ::ethers::core::types::U256,
    }
    ///Custom Error type `ProposalNotInVettingPeriod` with signature `ProposalNotInVettingPeriod(uint256,uint256)` and selector `0x8a807f1f`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "ProposalNotInVettingPeriod",
        abi = "ProposalNotInVettingPeriod(uint256,uint256)"
    )]
    pub struct ProposalNotInVettingPeriod {
        pub block_number: ::ethers::core::types::U256,
        pub vetting_deadline: ::ethers::core::types::U256,
    }
    ///Custom Error type `ProposalNotPending` with signature `ProposalNotPending(uint8)` and selector `0x1d24fc6a`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "ProposalNotPending", abi = "ProposalNotPending(uint8)")]
    pub struct ProposalNotPending {
        pub state: u8,
    }
    ///Custom Error type `ProposalNotSucceededState` with signature `ProposalNotSucceededState(uint8)` and selector `0x7e16558b`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "ProposalNotSucceededState",
        abi = "ProposalNotSucceededState(uint8)"
    )]
    pub struct ProposalNotSucceededState {
        pub state: u8,
    }
    ///Custom Error type `ProposeDisabled` with signature `ProposeDisabled()` and selector `0xa52710d2`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "ProposeDisabled", abi = "ProposeDisabled()")]
    pub struct ProposeDisabled;
    ///Custom Error type `QuorumNumeratorTooLow` with signature `QuorumNumeratorTooLow(uint256)` and selector `0x16bb52f0`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "QuorumNumeratorTooLow", abi = "QuorumNumeratorTooLow(uint256)")]
    pub struct QuorumNumeratorTooLow {
        pub quorum_numerator_value: ::ethers::core::types::U256,
    }
    ///Custom Error type `StartDateTooEarly` with signature `StartDateTooEarly(uint256,uint256)` and selector `0xf179c536`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "StartDateTooEarly", abi = "StartDateTooEarly(uint256,uint256)")]
    pub struct StartDateTooEarly {
        pub start_time: ::ethers::core::types::U256,
        pub current_time: ::ethers::core::types::U256,
    }
    ///Custom Error type `UnexpectedParamsLength` with signature `UnexpectedParamsLength(uint256)` and selector `0xb575b425`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "UnexpectedParamsLength",
        abi = "UnexpectedParamsLength(uint256)"
    )]
    pub struct UnexpectedParamsLength {
        pub param_length: ::ethers::core::types::U256,
    }
    ///Custom Error type `VoteAlreadyCast` with signature `VoteAlreadyCast(address,uint256,bytes32)` and selector `0x62d524b0`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(
        name = "VoteAlreadyCast",
        abi = "VoteAlreadyCast(address,uint256,bytes32)"
    )]
    pub struct VoteAlreadyCast {
        pub voter: ::ethers::core::types::Address,
        pub proposal_id: ::ethers::core::types::U256,
        pub replay_hash: [u8; 32],
    }
    ///Custom Error type `ZeroAddress` with signature `ZeroAddress()` and selector `0xd92e233d`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "ZeroAddress", abi = "ZeroAddress()")]
    pub struct ZeroAddress;
    ///Container type for all of the contract's custom errors
    #[derive(Clone, ::ethers::contract::EthAbiType, Debug, PartialEq, Eq, Hash)]
    pub enum RindexerArbitrumSCNominationsGenErrors {
        AccountInOtherCohort(AccountInOtherCohort),
        AlreadyContender(AlreadyContender),
        CastVoteDisabled(CastVoteDisabled),
        CompliantNomineeTargetHit(CompliantNomineeTargetHit),
        CreateTooEarly(CreateTooEarly),
        Deprecated(Deprecated),
        Empty(Empty),
        InsufficientCompliantNomineeCount(InsufficientCompliantNomineeCount),
        InsufficientTokens(InsufficientTokens),
        InvalidSignature(InvalidSignature),
        InvalidStartDate(InvalidStartDate),
        InvalidSupport(InvalidSupport),
        LastMemberElectionNotExecuted(LastMemberElectionNotExecuted),
        NomineeAlreadyAdded(NomineeAlreadyAdded),
        NomineeAlreadyExcluded(NomineeAlreadyExcluded),
        NotAContract(NotAContract),
        NotEligibleContender(NotEligibleContender),
        NotNominee(NotNominee),
        OnlyNomineeVetter(OnlyNomineeVetter),
        ProposalIdMismatch(ProposalIdMismatch),
        ProposalInVettingPeriod(ProposalInVettingPeriod),
        ProposalNotInVettingPeriod(ProposalNotInVettingPeriod),
        ProposalNotPending(ProposalNotPending),
        ProposalNotSucceededState(ProposalNotSucceededState),
        ProposeDisabled(ProposeDisabled),
        QuorumNumeratorTooLow(QuorumNumeratorTooLow),
        StartDateTooEarly(StartDateTooEarly),
        UnexpectedParamsLength(UnexpectedParamsLength),
        VoteAlreadyCast(VoteAlreadyCast),
        ZeroAddress(ZeroAddress),
        /// The standard solidity revert string, with selector
        /// Error(string) -- 0x08c379a0
        RevertString(::std::string::String),
    }
    impl ::ethers::core::abi::AbiDecode for RindexerArbitrumSCNominationsGenErrors {
        fn decode(data: impl AsRef<[u8]>) -> ::core::result::Result<Self, ::ethers::core::abi::AbiError> {
            let data = data.as_ref();
            if let Ok(decoded) = <::std::string::String as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::RevertString(decoded));
            }
            if let Ok(decoded) = <AccountInOtherCohort as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::AccountInOtherCohort(decoded));
            }
            if let Ok(decoded) = <AlreadyContender as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::AlreadyContender(decoded));
            }
            if let Ok(decoded) = <CastVoteDisabled as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CastVoteDisabled(decoded));
            }
            if let Ok(decoded) = <CompliantNomineeTargetHit as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CompliantNomineeTargetHit(decoded));
            }
            if let Ok(decoded) = <CreateTooEarly as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CreateTooEarly(decoded));
            }
            if let Ok(decoded) = <Deprecated as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Deprecated(decoded));
            }
            if let Ok(decoded) = <Empty as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Empty(decoded));
            }
            if let Ok(decoded) = <InsufficientCompliantNomineeCount as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::InsufficientCompliantNomineeCount(decoded));
            }
            if let Ok(decoded) = <InsufficientTokens as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::InsufficientTokens(decoded));
            }
            if let Ok(decoded) = <InvalidSignature as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::InvalidSignature(decoded));
            }
            if let Ok(decoded) = <InvalidStartDate as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::InvalidStartDate(decoded));
            }
            if let Ok(decoded) = <InvalidSupport as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::InvalidSupport(decoded));
            }
            if let Ok(decoded) = <LastMemberElectionNotExecuted as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::LastMemberElectionNotExecuted(decoded));
            }
            if let Ok(decoded) = <NomineeAlreadyAdded as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::NomineeAlreadyAdded(decoded));
            }
            if let Ok(decoded) = <NomineeAlreadyExcluded as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::NomineeAlreadyExcluded(decoded));
            }
            if let Ok(decoded) = <NotAContract as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::NotAContract(decoded));
            }
            if let Ok(decoded) = <NotEligibleContender as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::NotEligibleContender(decoded));
            }
            if let Ok(decoded) = <NotNominee as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::NotNominee(decoded));
            }
            if let Ok(decoded) = <OnlyNomineeVetter as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::OnlyNomineeVetter(decoded));
            }
            if let Ok(decoded) = <ProposalIdMismatch as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalIdMismatch(decoded));
            }
            if let Ok(decoded) = <ProposalInVettingPeriod as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalInVettingPeriod(decoded));
            }
            if let Ok(decoded) = <ProposalNotInVettingPeriod as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalNotInVettingPeriod(decoded));
            }
            if let Ok(decoded) = <ProposalNotPending as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalNotPending(decoded));
            }
            if let Ok(decoded) = <ProposalNotSucceededState as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalNotSucceededState(decoded));
            }
            if let Ok(decoded) = <ProposeDisabled as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposeDisabled(decoded));
            }
            if let Ok(decoded) = <QuorumNumeratorTooLow as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::QuorumNumeratorTooLow(decoded));
            }
            if let Ok(decoded) = <StartDateTooEarly as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::StartDateTooEarly(decoded));
            }
            if let Ok(decoded) = <UnexpectedParamsLength as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::UnexpectedParamsLength(decoded));
            }
            if let Ok(decoded) = <VoteAlreadyCast as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::VoteAlreadyCast(decoded));
            }
            if let Ok(decoded) = <ZeroAddress as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ZeroAddress(decoded));
            }
            Err(::ethers::core::abi::Error::InvalidData.into())
        }
    }
    impl ::ethers::core::abi::AbiEncode for RindexerArbitrumSCNominationsGenErrors {
        fn encode(self) -> ::std::vec::Vec<u8> {
            match self {
                Self::AccountInOtherCohort(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::AlreadyContender(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVoteDisabled(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CompliantNomineeTargetHit(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CreateTooEarly(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Deprecated(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Empty(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::InsufficientCompliantNomineeCount(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::InsufficientTokens(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::InvalidSignature(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::InvalidStartDate(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::InvalidSupport(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::LastMemberElectionNotExecuted(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::NomineeAlreadyAdded(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::NomineeAlreadyExcluded(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::NotAContract(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::NotEligibleContender(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::NotNominee(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::OnlyNomineeVetter(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalIdMismatch(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalInVettingPeriod(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalNotInVettingPeriod(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalNotPending(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalNotSucceededState(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposeDisabled(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::QuorumNumeratorTooLow(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::StartDateTooEarly(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::UnexpectedParamsLength(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::VoteAlreadyCast(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ZeroAddress(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::RevertString(s) => ::ethers::core::abi::AbiEncode::encode(s),
            }
        }
    }
    impl ::ethers::contract::ContractRevert for RindexerArbitrumSCNominationsGenErrors {
        fn valid_selector(selector: [u8; 4]) -> bool {
            match selector {
                [0x08, 0xc3, 0x79, 0xa0] => true,
                _ if selector == <AccountInOtherCohort as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <AlreadyContender as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <CastVoteDisabled as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <CompliantNomineeTargetHit as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <CreateTooEarly as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <Deprecated as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <Empty as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <InsufficientCompliantNomineeCount as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <InsufficientTokens as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <InvalidSignature as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <InvalidStartDate as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <InvalidSupport as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <LastMemberElectionNotExecuted as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <NomineeAlreadyAdded as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <NomineeAlreadyExcluded as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <NotAContract as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <NotEligibleContender as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <NotNominee as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <OnlyNomineeVetter as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <ProposalIdMismatch as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <ProposalInVettingPeriod as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <ProposalNotInVettingPeriod as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <ProposalNotPending as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <ProposalNotSucceededState as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <ProposeDisabled as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <QuorumNumeratorTooLow as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <StartDateTooEarly as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <UnexpectedParamsLength as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <VoteAlreadyCast as ::ethers::contract::EthError>::selector() => true,
                _ if selector == <ZeroAddress as ::ethers::contract::EthError>::selector() => true,
                _ => false,
            }
        }
    }
    impl ::core::fmt::Display for RindexerArbitrumSCNominationsGenErrors {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
            match self {
                Self::AccountInOtherCohort(element) => ::core::fmt::Display::fmt(element, f),
                Self::AlreadyContender(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVoteDisabled(element) => ::core::fmt::Display::fmt(element, f),
                Self::CompliantNomineeTargetHit(element) => ::core::fmt::Display::fmt(element, f),
                Self::CreateTooEarly(element) => ::core::fmt::Display::fmt(element, f),
                Self::Deprecated(element) => ::core::fmt::Display::fmt(element, f),
                Self::Empty(element) => ::core::fmt::Display::fmt(element, f),
                Self::InsufficientCompliantNomineeCount(element) => ::core::fmt::Display::fmt(element, f),
                Self::InsufficientTokens(element) => ::core::fmt::Display::fmt(element, f),
                Self::InvalidSignature(element) => ::core::fmt::Display::fmt(element, f),
                Self::InvalidStartDate(element) => ::core::fmt::Display::fmt(element, f),
                Self::InvalidSupport(element) => ::core::fmt::Display::fmt(element, f),
                Self::LastMemberElectionNotExecuted(element) => ::core::fmt::Display::fmt(element, f),
                Self::NomineeAlreadyAdded(element) => ::core::fmt::Display::fmt(element, f),
                Self::NomineeAlreadyExcluded(element) => ::core::fmt::Display::fmt(element, f),
                Self::NotAContract(element) => ::core::fmt::Display::fmt(element, f),
                Self::NotEligibleContender(element) => ::core::fmt::Display::fmt(element, f),
                Self::NotNominee(element) => ::core::fmt::Display::fmt(element, f),
                Self::OnlyNomineeVetter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalIdMismatch(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalInVettingPeriod(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalNotInVettingPeriod(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalNotPending(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalNotSucceededState(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposeDisabled(element) => ::core::fmt::Display::fmt(element, f),
                Self::QuorumNumeratorTooLow(element) => ::core::fmt::Display::fmt(element, f),
                Self::StartDateTooEarly(element) => ::core::fmt::Display::fmt(element, f),
                Self::UnexpectedParamsLength(element) => ::core::fmt::Display::fmt(element, f),
                Self::VoteAlreadyCast(element) => ::core::fmt::Display::fmt(element, f),
                Self::ZeroAddress(element) => ::core::fmt::Display::fmt(element, f),
                Self::RevertString(s) => ::core::fmt::Display::fmt(s, f),
            }
        }
    }
    impl ::core::convert::From<::std::string::String> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: String) -> Self {
            Self::RevertString(value)
        }
    }
    impl ::core::convert::From<AccountInOtherCohort> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: AccountInOtherCohort) -> Self {
            Self::AccountInOtherCohort(value)
        }
    }
    impl ::core::convert::From<AlreadyContender> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: AlreadyContender) -> Self {
            Self::AlreadyContender(value)
        }
    }
    impl ::core::convert::From<CastVoteDisabled> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: CastVoteDisabled) -> Self {
            Self::CastVoteDisabled(value)
        }
    }
    impl ::core::convert::From<CompliantNomineeTargetHit> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: CompliantNomineeTargetHit) -> Self {
            Self::CompliantNomineeTargetHit(value)
        }
    }
    impl ::core::convert::From<CreateTooEarly> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: CreateTooEarly) -> Self {
            Self::CreateTooEarly(value)
        }
    }
    impl ::core::convert::From<Deprecated> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: Deprecated) -> Self {
            Self::Deprecated(value)
        }
    }
    impl ::core::convert::From<Empty> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: Empty) -> Self {
            Self::Empty(value)
        }
    }
    impl ::core::convert::From<InsufficientCompliantNomineeCount> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: InsufficientCompliantNomineeCount) -> Self {
            Self::InsufficientCompliantNomineeCount(value)
        }
    }
    impl ::core::convert::From<InsufficientTokens> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: InsufficientTokens) -> Self {
            Self::InsufficientTokens(value)
        }
    }
    impl ::core::convert::From<InvalidSignature> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: InvalidSignature) -> Self {
            Self::InvalidSignature(value)
        }
    }
    impl ::core::convert::From<InvalidStartDate> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: InvalidStartDate) -> Self {
            Self::InvalidStartDate(value)
        }
    }
    impl ::core::convert::From<InvalidSupport> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: InvalidSupport) -> Self {
            Self::InvalidSupport(value)
        }
    }
    impl ::core::convert::From<LastMemberElectionNotExecuted> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: LastMemberElectionNotExecuted) -> Self {
            Self::LastMemberElectionNotExecuted(value)
        }
    }
    impl ::core::convert::From<NomineeAlreadyAdded> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: NomineeAlreadyAdded) -> Self {
            Self::NomineeAlreadyAdded(value)
        }
    }
    impl ::core::convert::From<NomineeAlreadyExcluded> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: NomineeAlreadyExcluded) -> Self {
            Self::NomineeAlreadyExcluded(value)
        }
    }
    impl ::core::convert::From<NotAContract> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: NotAContract) -> Self {
            Self::NotAContract(value)
        }
    }
    impl ::core::convert::From<NotEligibleContender> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: NotEligibleContender) -> Self {
            Self::NotEligibleContender(value)
        }
    }
    impl ::core::convert::From<NotNominee> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: NotNominee) -> Self {
            Self::NotNominee(value)
        }
    }
    impl ::core::convert::From<OnlyNomineeVetter> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: OnlyNomineeVetter) -> Self {
            Self::OnlyNomineeVetter(value)
        }
    }
    impl ::core::convert::From<ProposalIdMismatch> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: ProposalIdMismatch) -> Self {
            Self::ProposalIdMismatch(value)
        }
    }
    impl ::core::convert::From<ProposalInVettingPeriod> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: ProposalInVettingPeriod) -> Self {
            Self::ProposalInVettingPeriod(value)
        }
    }
    impl ::core::convert::From<ProposalNotInVettingPeriod> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: ProposalNotInVettingPeriod) -> Self {
            Self::ProposalNotInVettingPeriod(value)
        }
    }
    impl ::core::convert::From<ProposalNotPending> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: ProposalNotPending) -> Self {
            Self::ProposalNotPending(value)
        }
    }
    impl ::core::convert::From<ProposalNotSucceededState> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: ProposalNotSucceededState) -> Self {
            Self::ProposalNotSucceededState(value)
        }
    }
    impl ::core::convert::From<ProposeDisabled> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: ProposeDisabled) -> Self {
            Self::ProposeDisabled(value)
        }
    }
    impl ::core::convert::From<QuorumNumeratorTooLow> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: QuorumNumeratorTooLow) -> Self {
            Self::QuorumNumeratorTooLow(value)
        }
    }
    impl ::core::convert::From<StartDateTooEarly> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: StartDateTooEarly) -> Self {
            Self::StartDateTooEarly(value)
        }
    }
    impl ::core::convert::From<UnexpectedParamsLength> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: UnexpectedParamsLength) -> Self {
            Self::UnexpectedParamsLength(value)
        }
    }
    impl ::core::convert::From<VoteAlreadyCast> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: VoteAlreadyCast) -> Self {
            Self::VoteAlreadyCast(value)
        }
    }
    impl ::core::convert::From<ZeroAddress> for RindexerArbitrumSCNominationsGenErrors {
        fn from(value: ZeroAddress) -> Self {
            Self::ZeroAddress(value)
        }
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(name = "ContenderAdded", abi = "ContenderAdded(uint256,address)")]
    pub struct ContenderAddedFilter {
        #[ethevent(indexed)]
        pub proposal_id: ::ethers::core::types::U256,
        #[ethevent(indexed)]
        pub contender: ::ethers::core::types::Address,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(name = "Initialized", abi = "Initialized(uint8)")]
    pub struct InitializedFilter {
        pub version: u8,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(name = "NewNominee", abi = "NewNominee(uint256,address)")]
    pub struct NewNomineeFilter {
        #[ethevent(indexed)]
        pub proposal_id: ::ethers::core::types::U256,
        #[ethevent(indexed)]
        pub nominee: ::ethers::core::types::Address,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(name = "NomineeExcluded", abi = "NomineeExcluded(uint256,address)")]
    pub struct NomineeExcludedFilter {
        #[ethevent(indexed)]
        pub proposal_id: ::ethers::core::types::U256,
        #[ethevent(indexed)]
        pub nominee: ::ethers::core::types::Address,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(
        name = "NomineeVetterChanged",
        abi = "NomineeVetterChanged(address,address)"
    )]
    pub struct NomineeVetterChangedFilter {
        #[ethevent(indexed)]
        pub old_nominee_vetter: ::ethers::core::types::Address,
        #[ethevent(indexed)]
        pub new_nominee_vetter: ::ethers::core::types::Address,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(
        name = "OwnershipTransferred",
        abi = "OwnershipTransferred(address,address)"
    )]
    pub struct OwnershipTransferredFilter {
        #[ethevent(indexed)]
        pub previous_owner: ::ethers::core::types::Address,
        #[ethevent(indexed)]
        pub new_owner: ::ethers::core::types::Address,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(name = "ProposalCanceled", abi = "ProposalCanceled(uint256)")]
    pub struct ProposalCanceledFilter {
        pub proposal_id: ::ethers::core::types::U256,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(
        name = "ProposalCreated",
        abi = "ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)"
    )]
    pub struct ProposalCreatedFilter {
        pub proposal_id: ::ethers::core::types::U256,
        pub proposer: ::ethers::core::types::Address,
        pub targets: ::std::vec::Vec<::ethers::core::types::Address>,
        pub values: ::std::vec::Vec<::ethers::core::types::U256>,
        pub signatures: ::std::vec::Vec<::std::string::String>,
        pub calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>,
        pub start_block: ::ethers::core::types::U256,
        pub end_block: ::ethers::core::types::U256,
        pub description: ::std::string::String,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(name = "ProposalExecuted", abi = "ProposalExecuted(uint256)")]
    pub struct ProposalExecutedFilter {
        pub proposal_id: ::ethers::core::types::U256,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(
        name = "ProposalThresholdSet",
        abi = "ProposalThresholdSet(uint256,uint256)"
    )]
    pub struct ProposalThresholdSetFilter {
        pub old_proposal_threshold: ::ethers::core::types::U256,
        pub new_proposal_threshold: ::ethers::core::types::U256,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(
        name = "QuorumNumeratorUpdated",
        abi = "QuorumNumeratorUpdated(uint256,uint256)"
    )]
    pub struct QuorumNumeratorUpdatedFilter {
        pub old_quorum_numerator: ::ethers::core::types::U256,
        pub new_quorum_numerator: ::ethers::core::types::U256,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(
        name = "VoteCast",
        abi = "VoteCast(address,uint256,uint8,uint256,string)"
    )]
    pub struct VoteCastFilter {
        #[ethevent(indexed)]
        pub voter: ::ethers::core::types::Address,
        pub proposal_id: ::ethers::core::types::U256,
        pub support: u8,
        pub weight: ::ethers::core::types::U256,
        pub reason: ::std::string::String,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(
        name = "VoteCastForContender",
        abi = "VoteCastForContender(uint256,address,address,uint256,uint256,uint256)"
    )]
    pub struct VoteCastForContenderFilter {
        #[ethevent(indexed)]
        pub proposal_id: ::ethers::core::types::U256,
        #[ethevent(indexed)]
        pub voter: ::ethers::core::types::Address,
        #[ethevent(indexed)]
        pub contender: ::ethers::core::types::Address,
        pub votes: ::ethers::core::types::U256,
        pub total_used_votes: ::ethers::core::types::U256,
        pub usable_votes: ::ethers::core::types::U256,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(
        name = "VoteCastWithParams",
        abi = "VoteCastWithParams(address,uint256,uint8,uint256,string,bytes)"
    )]
    pub struct VoteCastWithParamsFilter {
        #[ethevent(indexed)]
        pub voter: ::ethers::core::types::Address,
        pub proposal_id: ::ethers::core::types::U256,
        pub support: u8,
        pub weight: ::ethers::core::types::U256,
        pub reason: ::std::string::String,
        pub params: ::ethers::core::types::Bytes,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(name = "VotingDelaySet", abi = "VotingDelaySet(uint256,uint256)")]
    pub struct VotingDelaySetFilter {
        pub old_voting_delay: ::ethers::core::types::U256,
        pub new_voting_delay: ::ethers::core::types::U256,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(name = "VotingPeriodSet", abi = "VotingPeriodSet(uint256,uint256)")]
    pub struct VotingPeriodSetFilter {
        pub old_voting_period: ::ethers::core::types::U256,
        pub new_voting_period: ::ethers::core::types::U256,
    }
    ///Container type for all of the contract's events
    #[derive(Clone, ::ethers::contract::EthAbiType, Debug, PartialEq, Eq, Hash)]
    pub enum RindexerArbitrumSCNominationsGenEvents {
        ContenderAddedFilter(ContenderAddedFilter),
        InitializedFilter(InitializedFilter),
        NewNomineeFilter(NewNomineeFilter),
        NomineeExcludedFilter(NomineeExcludedFilter),
        NomineeVetterChangedFilter(NomineeVetterChangedFilter),
        OwnershipTransferredFilter(OwnershipTransferredFilter),
        ProposalCanceledFilter(ProposalCanceledFilter),
        ProposalCreatedFilter(ProposalCreatedFilter),
        ProposalExecutedFilter(ProposalExecutedFilter),
        ProposalThresholdSetFilter(ProposalThresholdSetFilter),
        QuorumNumeratorUpdatedFilter(QuorumNumeratorUpdatedFilter),
        VoteCastFilter(VoteCastFilter),
        VoteCastForContenderFilter(VoteCastForContenderFilter),
        VoteCastWithParamsFilter(VoteCastWithParamsFilter),
        VotingDelaySetFilter(VotingDelaySetFilter),
        VotingPeriodSetFilter(VotingPeriodSetFilter),
    }
    impl ::ethers::contract::EthLogDecode for RindexerArbitrumSCNominationsGenEvents {
        fn decode_log(log: &::ethers::core::abi::RawLog) -> ::core::result::Result<Self, ::ethers::core::abi::Error> {
            if let Ok(decoded) = ContenderAddedFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::ContenderAddedFilter(decoded));
            }
            if let Ok(decoded) = InitializedFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::InitializedFilter(
                    decoded,
                ));
            }
            if let Ok(decoded) = NewNomineeFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::NewNomineeFilter(
                    decoded,
                ));
            }
            if let Ok(decoded) = NomineeExcludedFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::NomineeExcludedFilter(decoded));
            }
            if let Ok(decoded) = NomineeVetterChangedFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::NomineeVetterChangedFilter(decoded));
            }
            if let Ok(decoded) = OwnershipTransferredFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::OwnershipTransferredFilter(decoded));
            }
            if let Ok(decoded) = ProposalCanceledFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::ProposalCanceledFilter(decoded));
            }
            if let Ok(decoded) = ProposalCreatedFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::ProposalCreatedFilter(decoded));
            }
            if let Ok(decoded) = ProposalExecutedFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::ProposalExecutedFilter(decoded));
            }
            if let Ok(decoded) = ProposalThresholdSetFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::ProposalThresholdSetFilter(decoded));
            }
            if let Ok(decoded) = QuorumNumeratorUpdatedFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::QuorumNumeratorUpdatedFilter(decoded));
            }
            if let Ok(decoded) = VoteCastFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::VoteCastFilter(
                    decoded,
                ));
            }
            if let Ok(decoded) = VoteCastForContenderFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::VoteCastForContenderFilter(decoded));
            }
            if let Ok(decoded) = VoteCastWithParamsFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::VoteCastWithParamsFilter(decoded));
            }
            if let Ok(decoded) = VotingDelaySetFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::VotingDelaySetFilter(decoded));
            }
            if let Ok(decoded) = VotingPeriodSetFilter::decode_log(log) {
                return Ok(RindexerArbitrumSCNominationsGenEvents::VotingPeriodSetFilter(decoded));
            }
            Err(::ethers::core::abi::Error::InvalidData)
        }
    }
    impl ::core::fmt::Display for RindexerArbitrumSCNominationsGenEvents {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
            match self {
                Self::ContenderAddedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::InitializedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::NewNomineeFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::NomineeExcludedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::NomineeVetterChangedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::OwnershipTransferredFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalCanceledFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalCreatedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalExecutedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalThresholdSetFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::QuorumNumeratorUpdatedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::VoteCastFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::VoteCastForContenderFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::VoteCastWithParamsFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::VotingDelaySetFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::VotingPeriodSetFilter(element) => ::core::fmt::Display::fmt(element, f),
            }
        }
    }
    impl ::core::convert::From<ContenderAddedFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: ContenderAddedFilter) -> Self {
            Self::ContenderAddedFilter(value)
        }
    }
    impl ::core::convert::From<InitializedFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: InitializedFilter) -> Self {
            Self::InitializedFilter(value)
        }
    }
    impl ::core::convert::From<NewNomineeFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: NewNomineeFilter) -> Self {
            Self::NewNomineeFilter(value)
        }
    }
    impl ::core::convert::From<NomineeExcludedFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: NomineeExcludedFilter) -> Self {
            Self::NomineeExcludedFilter(value)
        }
    }
    impl ::core::convert::From<NomineeVetterChangedFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: NomineeVetterChangedFilter) -> Self {
            Self::NomineeVetterChangedFilter(value)
        }
    }
    impl ::core::convert::From<OwnershipTransferredFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: OwnershipTransferredFilter) -> Self {
            Self::OwnershipTransferredFilter(value)
        }
    }
    impl ::core::convert::From<ProposalCanceledFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: ProposalCanceledFilter) -> Self {
            Self::ProposalCanceledFilter(value)
        }
    }
    impl ::core::convert::From<ProposalCreatedFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: ProposalCreatedFilter) -> Self {
            Self::ProposalCreatedFilter(value)
        }
    }
    impl ::core::convert::From<ProposalExecutedFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: ProposalExecutedFilter) -> Self {
            Self::ProposalExecutedFilter(value)
        }
    }
    impl ::core::convert::From<ProposalThresholdSetFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: ProposalThresholdSetFilter) -> Self {
            Self::ProposalThresholdSetFilter(value)
        }
    }
    impl ::core::convert::From<QuorumNumeratorUpdatedFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: QuorumNumeratorUpdatedFilter) -> Self {
            Self::QuorumNumeratorUpdatedFilter(value)
        }
    }
    impl ::core::convert::From<VoteCastFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: VoteCastFilter) -> Self {
            Self::VoteCastFilter(value)
        }
    }
    impl ::core::convert::From<VoteCastForContenderFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: VoteCastForContenderFilter) -> Self {
            Self::VoteCastForContenderFilter(value)
        }
    }
    impl ::core::convert::From<VoteCastWithParamsFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: VoteCastWithParamsFilter) -> Self {
            Self::VoteCastWithParamsFilter(value)
        }
    }
    impl ::core::convert::From<VotingDelaySetFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: VotingDelaySetFilter) -> Self {
            Self::VotingDelaySetFilter(value)
        }
    }
    impl ::core::convert::From<VotingPeriodSetFilter> for RindexerArbitrumSCNominationsGenEvents {
        fn from(value: VotingPeriodSetFilter) -> Self {
            Self::VotingPeriodSetFilter(value)
        }
    }
    ///Container type for all input parameters for the `BALLOT_TYPEHASH` function with signature `BALLOT_TYPEHASH()` and selector `0xdeaaa7cc`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "BALLOT_TYPEHASH", abi = "BALLOT_TYPEHASH()")]
    pub struct BallotTypehashCall;
    ///Container type for all input parameters for the `COUNTING_MODE` function with signature `COUNTING_MODE()` and selector `0xdd4e2ba5`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "COUNTING_MODE", abi = "COUNTING_MODE()")]
    pub struct CountingModeCall;
    ///Container type for all input parameters for the `EXCLUDE_ADDRESS` function with signature `EXCLUDE_ADDRESS()` and selector `0x5e12ebbd`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "EXCLUDE_ADDRESS", abi = "EXCLUDE_ADDRESS()")]
    pub struct ExcludeAddressCall;
    ///Container type for all input parameters for the `EXTENDED_BALLOT_TYPEHASH` function with signature `EXTENDED_BALLOT_TYPEHASH()` and selector `0x2fe3e261`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "EXTENDED_BALLOT_TYPEHASH", abi = "EXTENDED_BALLOT_TYPEHASH()")]
    pub struct ExtendedBallotTypehashCall;
    ///Container type for all input parameters for the `addContender` function with signature `addContender(uint256)` and selector `0x140af012`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "addContender", abi = "addContender(uint256)")]
    pub struct AddContenderCall(pub ::ethers::core::types::U256);
    ///Container type for all input parameters for the `addContender` function with signature `addContender(uint256,bytes)` and selector `0xa8f38759`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "addContender", abi = "addContender(uint256,bytes)")]
    pub struct AddContenderWithProposalIdCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub signature: ::ethers::core::types::Bytes,
    }
    ///Container type for all input parameters for the `castVote` function with signature `castVote(uint256,uint8)` and selector `0x56781388`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "castVote", abi = "castVote(uint256,uint8)")]
    pub struct CastVoteCall(pub ::ethers::core::types::U256, pub u8);
    ///Container type for all input parameters for the `castVoteBySig` function with signature `castVoteBySig(uint256,uint8,uint8,bytes32,bytes32)` and selector `0x3bccf4fd`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "castVoteBySig",
        abi = "castVoteBySig(uint256,uint8,uint8,bytes32,bytes32)"
    )]
    pub struct CastVoteBySigCall(
        pub ::ethers::core::types::U256,
        pub u8,
        pub u8,
        pub [u8; 32],
        pub [u8; 32],
    );
    ///Container type for all input parameters for the `castVoteWithReason` function with signature `castVoteWithReason(uint256,uint8,string)` and selector `0x7b3c71d3`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "castVoteWithReason",
        abi = "castVoteWithReason(uint256,uint8,string)"
    )]
    pub struct CastVoteWithReasonCall(
        pub ::ethers::core::types::U256,
        pub u8,
        pub ::std::string::String,
    );
    ///Container type for all input parameters for the `castVoteWithReasonAndParams` function with signature `castVoteWithReasonAndParams(uint256,uint8,string,bytes)` and selector `0x5f398a14`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "castVoteWithReasonAndParams",
        abi = "castVoteWithReasonAndParams(uint256,uint8,string,bytes)"
    )]
    pub struct CastVoteWithReasonAndParamsCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub support: u8,
        pub reason: ::std::string::String,
        pub params: ::ethers::core::types::Bytes,
    }
    ///Container type for all input parameters for the `castVoteWithReasonAndParamsBySig` function with signature `castVoteWithReasonAndParamsBySig(uint256,uint8,string,bytes,uint8,bytes32,bytes32)` and selector `0x03420181`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "castVoteWithReasonAndParamsBySig",
        abi = "castVoteWithReasonAndParamsBySig(uint256,uint8,string,bytes,uint8,bytes32,bytes32)"
    )]
    pub struct CastVoteWithReasonAndParamsBySigCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub support: u8,
        pub reason: ::std::string::String,
        pub params: ::ethers::core::types::Bytes,
        pub v: u8,
        pub r: [u8; 32],
        pub s: [u8; 32],
    }
    ///Container type for all input parameters for the `compliantNomineeCount` function with signature `compliantNomineeCount(uint256)` and selector `0xe0c11ff6`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "compliantNomineeCount", abi = "compliantNomineeCount(uint256)")]
    pub struct CompliantNomineeCountCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `compliantNominees` function with signature `compliantNominees(uint256)` and selector `0xf3dfd61c`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "compliantNominees", abi = "compliantNominees(uint256)")]
    pub struct CompliantNomineesCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `createElection` function with signature `createElection()` and selector `0x24c2286c`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "createElection", abi = "createElection()")]
    pub struct CreateElectionCall;
    ///Container type for all input parameters for the `currentCohort` function with signature `currentCohort()` and selector `0xe0f9c970`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "currentCohort", abi = "currentCohort()")]
    pub struct CurrentCohortCall;
    ///Container type for all input parameters for the `electionCount` function with signature `electionCount()` and selector `0x997d2830`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "electionCount", abi = "electionCount()")]
    pub struct ElectionCountCall;
    ///Container type for all input parameters for the `electionIndexToCohort` function with signature `electionIndexToCohort(uint256)` and selector `0x33bb6f4b`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "electionIndexToCohort", abi = "electionIndexToCohort(uint256)")]
    pub struct ElectionIndexToCohortCall {
        pub election_index: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `electionIndexToDescription` function with signature `electionIndexToDescription(uint256)` and selector `0x276ae91a`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "electionIndexToDescription",
        abi = "electionIndexToDescription(uint256)"
    )]
    pub struct ElectionIndexToDescriptionCall {
        pub election_index: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `electionToTimestamp` function with signature `electionToTimestamp(uint256)` and selector `0xc2192dc1`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "electionToTimestamp", abi = "electionToTimestamp(uint256)")]
    pub struct ElectionToTimestampCall {
        pub election_index: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `excludeNominee` function with signature `excludeNominee(uint256,address)` and selector `0xe97ada39`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "excludeNominee", abi = "excludeNominee(uint256,address)")]
    pub struct ExcludeNomineeCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub nominee: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `excludedNomineeCount` function with signature `excludedNomineeCount(uint256)` and selector `0xb0ee63f2`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "excludedNomineeCount", abi = "excludedNomineeCount(uint256)")]
    pub struct ExcludedNomineeCountCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `execute` function with signature `execute(address[],uint256[],bytes[],bytes32)` and selector `0x2656227d`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "execute", abi = "execute(address[],uint256[],bytes[],bytes32)")]
    pub struct ExecuteCall {
        pub targets: ::std::vec::Vec<::ethers::core::types::Address>,
        pub values: ::std::vec::Vec<::ethers::core::types::U256>,
        pub calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>,
        pub description_hash: [u8; 32],
    }
    ///Container type for all input parameters for the `firstNominationStartDate` function with signature `firstNominationStartDate()` and selector `0xbeb28536`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "firstNominationStartDate", abi = "firstNominationStartDate()")]
    pub struct FirstNominationStartDateCall;
    ///Container type for all input parameters for the `getPastCirculatingSupply` function with signature `getPastCirculatingSupply(uint256)` and selector `0x6e462680`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "getPastCirculatingSupply",
        abi = "getPastCirculatingSupply(uint256)"
    )]
    pub struct GetPastCirculatingSupplyCall {
        pub block_number: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `getProposeArgs` function with signature `getProposeArgs(uint256)` and selector `0x1f0ac182`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "getProposeArgs", abi = "getProposeArgs(uint256)")]
    pub struct GetProposeArgsCall {
        pub election_index: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `getVotes` function with signature `getVotes(address,uint256)` and selector `0xeb9019d4`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "getVotes", abi = "getVotes(address,uint256)")]
    pub struct GetVotesCall {
        pub account: ::ethers::core::types::Address,
        pub block_number: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `getVotesWithParams` function with signature `getVotesWithParams(address,uint256,bytes)` and selector `0x9a802a6d`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "getVotesWithParams",
        abi = "getVotesWithParams(address,uint256,bytes)"
    )]
    pub struct GetVotesWithParamsCall {
        pub account: ::ethers::core::types::Address,
        pub block_number: ::ethers::core::types::U256,
        pub params: ::ethers::core::types::Bytes,
    }
    ///Container type for all input parameters for the `hasVoted` function with signature `hasVoted(uint256,address)` and selector `0x43859632`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "hasVoted", abi = "hasVoted(uint256,address)")]
    pub struct HasVotedCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub account: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `hashProposal` function with signature `hashProposal(address[],uint256[],bytes[],bytes32)` and selector `0xc59057e4`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "hashProposal",
        abi = "hashProposal(address[],uint256[],bytes[],bytes32)"
    )]
    pub struct HashProposalCall {
        pub targets: ::std::vec::Vec<::ethers::core::types::Address>,
        pub values: ::std::vec::Vec<::ethers::core::types::U256>,
        pub calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>,
        pub description_hash: [u8; 32],
    }
    ///Container type for all input parameters for the `includeNominee` function with signature `includeNominee(uint256,address)` and selector `0x35334628`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "includeNominee", abi = "includeNominee(uint256,address)")]
    pub struct IncludeNomineeCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub account: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `initialize` function with signature `initialize(((uint256,uint256,uint256,uint256),uint256,address,address,address,address,address,uint256,uint256))` and selector `0x40e8c5cb`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "initialize",
        abi = "initialize(((uint256,uint256,uint256,uint256),uint256,address,address,address,address,address,uint256,uint256))"
    )]
    pub struct InitializeCall {
        pub params: InitParams,
    }
    ///Container type for all input parameters for the `isCompliantNominee` function with signature `isCompliantNominee(uint256,address)` and selector `0xc16e0ec6`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "isCompliantNominee",
        abi = "isCompliantNominee(uint256,address)"
    )]
    pub struct IsCompliantNomineeCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub account: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `isContender` function with signature `isContender(uint256,address)` and selector `0xeba4b237`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "isContender", abi = "isContender(uint256,address)")]
    pub struct IsContenderCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub possible_contender: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `isExcluded` function with signature `isExcluded(uint256,address)` and selector `0x3b158390`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "isExcluded", abi = "isExcluded(uint256,address)")]
    pub struct IsExcludedCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub possible_excluded: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `isNominee` function with signature `isNominee(uint256,address)` and selector `0x7d60af91`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "isNominee", abi = "isNominee(uint256,address)")]
    pub struct IsNomineeCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub contender: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `name` function with signature `name()` and selector `0x06fdde03`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "name", abi = "name()")]
    pub struct NameCall;
    ///Container type for all input parameters for the `nomineeCount` function with signature `nomineeCount(uint256)` and selector `0xe63f88a8`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "nomineeCount", abi = "nomineeCount(uint256)")]
    pub struct NomineeCountCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `nomineeVetter` function with signature `nomineeVetter()` and selector `0x0298ad49`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "nomineeVetter", abi = "nomineeVetter()")]
    pub struct NomineeVetterCall;
    ///Container type for all input parameters for the `nomineeVettingDuration` function with signature `nomineeVettingDuration()` and selector `0x45110965`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "nomineeVettingDuration", abi = "nomineeVettingDuration()")]
    pub struct NomineeVettingDurationCall;
    ///Container type for all input parameters for the `nominees` function with signature `nominees(uint256)` and selector `0xeec6b91e`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "nominees", abi = "nominees(uint256)")]
    pub struct NomineesCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `onERC1155BatchReceived` function with signature `onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)` and selector `0xbc197c81`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "onERC1155BatchReceived",
        abi = "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"
    )]
    pub struct OnERC1155BatchReceivedCall(
        pub ::ethers::core::types::Address,
        pub ::ethers::core::types::Address,
        pub ::std::vec::Vec<::ethers::core::types::U256>,
        pub ::std::vec::Vec<::ethers::core::types::U256>,
        pub ::ethers::core::types::Bytes,
    );
    ///Container type for all input parameters for the `onERC1155Received` function with signature `onERC1155Received(address,address,uint256,uint256,bytes)` and selector `0xf23a6e61`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "onERC1155Received",
        abi = "onERC1155Received(address,address,uint256,uint256,bytes)"
    )]
    pub struct OnERC1155ReceivedCall(
        pub ::ethers::core::types::Address,
        pub ::ethers::core::types::Address,
        pub ::ethers::core::types::U256,
        pub ::ethers::core::types::U256,
        pub ::ethers::core::types::Bytes,
    );
    ///Container type for all input parameters for the `onERC721Received` function with signature `onERC721Received(address,address,uint256,bytes)` and selector `0x150b7a02`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "onERC721Received",
        abi = "onERC721Received(address,address,uint256,bytes)"
    )]
    pub struct OnERC721ReceivedCall(
        pub ::ethers::core::types::Address,
        pub ::ethers::core::types::Address,
        pub ::ethers::core::types::U256,
        pub ::ethers::core::types::Bytes,
    );
    ///Container type for all input parameters for the `otherCohort` function with signature `otherCohort()` and selector `0xcf5d27c4`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "otherCohort", abi = "otherCohort()")]
    pub struct OtherCohortCall;
    ///Container type for all input parameters for the `owner` function with signature `owner()` and selector `0x8da5cb5b`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "owner", abi = "owner()")]
    pub struct OwnerCall;
    ///Container type for all input parameters for the `proposalDeadline` function with signature `proposalDeadline(uint256)` and selector `0xc01f9e37`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "proposalDeadline", abi = "proposalDeadline(uint256)")]
    pub struct ProposalDeadlineCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `proposalSnapshot` function with signature `proposalSnapshot(uint256)` and selector `0x2d63f693`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "proposalSnapshot", abi = "proposalSnapshot(uint256)")]
    pub struct ProposalSnapshotCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `proposalThreshold` function with signature `proposalThreshold()` and selector `0xb58131b0`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "proposalThreshold", abi = "proposalThreshold()")]
    pub struct ProposalThresholdCall;
    ///Container type for all input parameters for the `proposalVettingDeadline` function with signature `proposalVettingDeadline(uint256)` and selector `0x2df2c649`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "proposalVettingDeadline",
        abi = "proposalVettingDeadline(uint256)"
    )]
    pub struct ProposalVettingDeadlineCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `propose` function with signature `propose(address[],uint256[],bytes[],string)` and selector `0x7d5e81e2`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "propose", abi = "propose(address[],uint256[],bytes[],string)")]
    pub struct ProposeCall(
        pub ::std::vec::Vec<::ethers::core::types::Address>,
        pub ::std::vec::Vec<::ethers::core::types::U256>,
        pub ::std::vec::Vec<::ethers::core::types::Bytes>,
        pub ::std::string::String,
    );
    ///Container type for all input parameters for the `quorum` function with signature `quorum(uint256)` and selector `0xf8ce560a`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "quorum", abi = "quorum(uint256)")]
    pub struct QuorumCall {
        pub block_number: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `quorumDenominator` function with signature `quorumDenominator()` and selector `0x97c3d334`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "quorumDenominator", abi = "quorumDenominator()")]
    pub struct QuorumDenominatorCall;
    ///Container type for all input parameters for the `quorumNumerator` function with signature `quorumNumerator(uint256)` and selector `0x60c4247f`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "quorumNumerator", abi = "quorumNumerator(uint256)")]
    pub struct QuorumNumeratorWithBlockNumberCall {
        pub block_number: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `quorumNumerator` function with signature `quorumNumerator()` and selector `0xa7713a70`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "quorumNumerator", abi = "quorumNumerator()")]
    pub struct QuorumNumeratorCall;
    ///Container type for all input parameters for the `recoverAddContenderMessage` function with signature `recoverAddContenderMessage(uint256,bytes)` and selector `0x5a756eaf`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "recoverAddContenderMessage",
        abi = "recoverAddContenderMessage(uint256,bytes)"
    )]
    pub struct RecoverAddContenderMessageCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub signature: ::ethers::core::types::Bytes,
    }
    ///Container type for all input parameters for the `relay` function with signature `relay(address,uint256,bytes)` and selector `0xc28bc2fa`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "relay", abi = "relay(address,uint256,bytes)")]
    pub struct RelayCall {
        pub target: ::ethers::core::types::Address,
        pub value: ::ethers::core::types::U256,
        pub data: ::ethers::core::types::Bytes,
    }
    ///Container type for all input parameters for the `renounceOwnership` function with signature `renounceOwnership()` and selector `0x715018a6`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "renounceOwnership", abi = "renounceOwnership()")]
    pub struct RenounceOwnershipCall;
    ///Container type for all input parameters for the `securityCouncilManager` function with signature `securityCouncilManager()` and selector `0x03d1ce8a`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "securityCouncilManager", abi = "securityCouncilManager()")]
    pub struct SecurityCouncilManagerCall;
    ///Container type for all input parameters for the `securityCouncilMemberElectionGovernor` function with signature `securityCouncilMemberElectionGovernor()` and selector `0x1b6a7673`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "securityCouncilMemberElectionGovernor",
        abi = "securityCouncilMemberElectionGovernor()"
    )]
    pub struct SecurityCouncilMemberElectionGovernorCall;
    ///Container type for all input parameters for the `setNomineeVetter` function with signature `setNomineeVetter(address)` and selector `0xae8acb5e`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "setNomineeVetter", abi = "setNomineeVetter(address)")]
    pub struct SetNomineeVetterCall {
        pub nominee_vetter: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `setProposalThreshold` function with signature `setProposalThreshold(uint256)` and selector `0xece40cc1`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "setProposalThreshold", abi = "setProposalThreshold(uint256)")]
    pub struct SetProposalThresholdCall {
        pub new_proposal_threshold: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `setVotingDelay` function with signature `setVotingDelay(uint256)` and selector `0x70b0f660`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "setVotingDelay", abi = "setVotingDelay(uint256)")]
    pub struct SetVotingDelayCall {
        pub new_voting_delay: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `setVotingPeriod` function with signature `setVotingPeriod(uint256)` and selector `0xea0217cf`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "setVotingPeriod", abi = "setVotingPeriod(uint256)")]
    pub struct SetVotingPeriodCall {
        pub new_voting_period: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `state` function with signature `state(uint256)` and selector `0x3e4f49e6`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "state", abi = "state(uint256)")]
    pub struct StateCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `supportsInterface` function with signature `supportsInterface(bytes4)` and selector `0x01ffc9a7`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "supportsInterface", abi = "supportsInterface(bytes4)")]
    pub struct SupportsInterfaceCall {
        pub interface_id: [u8; 4],
    }
    ///Container type for all input parameters for the `token` function with signature `token()` and selector `0xfc0c546a`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "token", abi = "token()")]
    pub struct TokenCall;
    ///Container type for all input parameters for the `transferOwnership` function with signature `transferOwnership(address)` and selector `0xf2fde38b`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "transferOwnership", abi = "transferOwnership(address)")]
    pub struct TransferOwnershipCall {
        pub new_owner: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `updateQuorumNumerator` function with signature `updateQuorumNumerator(uint256)` and selector `0x06f3f9e6`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "updateQuorumNumerator", abi = "updateQuorumNumerator(uint256)")]
    pub struct UpdateQuorumNumeratorCall {
        pub new_quorum_numerator: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `usedNonces` function with signature `usedNonces(bytes32)` and selector `0xfeb61724`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "usedNonces", abi = "usedNonces(bytes32)")]
    pub struct UsedNoncesCall(pub [u8; 32]);
    ///Container type for all input parameters for the `version` function with signature `version()` and selector `0x54fd4d50`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "version", abi = "version()")]
    pub struct VersionCall;
    ///Container type for all input parameters for the `votesReceived` function with signature `votesReceived(uint256,address)` and selector `0x33dd6bed`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "votesReceived", abi = "votesReceived(uint256,address)")]
    pub struct VotesReceivedCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub contender: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `votesUsed` function with signature `votesUsed(uint256,address)` and selector `0x9523730e`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "votesUsed", abi = "votesUsed(uint256,address)")]
    pub struct VotesUsedCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub account: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `votingDelay` function with signature `votingDelay()` and selector `0x3932abb1`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "votingDelay", abi = "votingDelay()")]
    pub struct VotingDelayCall;
    ///Container type for all input parameters for the `votingPeriod` function with signature `votingPeriod()` and selector `0x02a251a3`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "votingPeriod", abi = "votingPeriod()")]
    pub struct VotingPeriodCall;
    ///Container type for all of the contract's call
    #[derive(Clone, ::ethers::contract::EthAbiType, Debug, PartialEq, Eq, Hash)]
    pub enum RindexerArbitrumSCNominationsGenCalls {
        BallotTypehash(BallotTypehashCall),
        CountingMode(CountingModeCall),
        ExcludeAddress(ExcludeAddressCall),
        ExtendedBallotTypehash(ExtendedBallotTypehashCall),
        AddContender(AddContenderCall),
        AddContenderWithProposalId(AddContenderWithProposalIdCall),
        CastVote(CastVoteCall),
        CastVoteBySig(CastVoteBySigCall),
        CastVoteWithReason(CastVoteWithReasonCall),
        CastVoteWithReasonAndParams(CastVoteWithReasonAndParamsCall),
        CastVoteWithReasonAndParamsBySig(CastVoteWithReasonAndParamsBySigCall),
        CompliantNomineeCount(CompliantNomineeCountCall),
        CompliantNominees(CompliantNomineesCall),
        CreateElection(CreateElectionCall),
        CurrentCohort(CurrentCohortCall),
        ElectionCount(ElectionCountCall),
        ElectionIndexToCohort(ElectionIndexToCohortCall),
        ElectionIndexToDescription(ElectionIndexToDescriptionCall),
        ElectionToTimestamp(ElectionToTimestampCall),
        ExcludeNominee(ExcludeNomineeCall),
        ExcludedNomineeCount(ExcludedNomineeCountCall),
        Execute(ExecuteCall),
        FirstNominationStartDate(FirstNominationStartDateCall),
        GetPastCirculatingSupply(GetPastCirculatingSupplyCall),
        GetProposeArgs(GetProposeArgsCall),
        GetVotes(GetVotesCall),
        GetVotesWithParams(GetVotesWithParamsCall),
        HasVoted(HasVotedCall),
        HashProposal(HashProposalCall),
        IncludeNominee(IncludeNomineeCall),
        Initialize(InitializeCall),
        IsCompliantNominee(IsCompliantNomineeCall),
        IsContender(IsContenderCall),
        IsExcluded(IsExcludedCall),
        IsNominee(IsNomineeCall),
        Name(NameCall),
        NomineeCount(NomineeCountCall),
        NomineeVetter(NomineeVetterCall),
        NomineeVettingDuration(NomineeVettingDurationCall),
        Nominees(NomineesCall),
        OnERC1155BatchReceived(OnERC1155BatchReceivedCall),
        OnERC1155Received(OnERC1155ReceivedCall),
        OnERC721Received(OnERC721ReceivedCall),
        OtherCohort(OtherCohortCall),
        Owner(OwnerCall),
        ProposalDeadline(ProposalDeadlineCall),
        ProposalSnapshot(ProposalSnapshotCall),
        ProposalThreshold(ProposalThresholdCall),
        ProposalVettingDeadline(ProposalVettingDeadlineCall),
        Propose(ProposeCall),
        Quorum(QuorumCall),
        QuorumDenominator(QuorumDenominatorCall),
        QuorumNumeratorWithBlockNumber(QuorumNumeratorWithBlockNumberCall),
        QuorumNumerator(QuorumNumeratorCall),
        RecoverAddContenderMessage(RecoverAddContenderMessageCall),
        Relay(RelayCall),
        RenounceOwnership(RenounceOwnershipCall),
        SecurityCouncilManager(SecurityCouncilManagerCall),
        SecurityCouncilMemberElectionGovernor(SecurityCouncilMemberElectionGovernorCall),
        SetNomineeVetter(SetNomineeVetterCall),
        SetProposalThreshold(SetProposalThresholdCall),
        SetVotingDelay(SetVotingDelayCall),
        SetVotingPeriod(SetVotingPeriodCall),
        State(StateCall),
        SupportsInterface(SupportsInterfaceCall),
        Token(TokenCall),
        TransferOwnership(TransferOwnershipCall),
        UpdateQuorumNumerator(UpdateQuorumNumeratorCall),
        UsedNonces(UsedNoncesCall),
        Version(VersionCall),
        VotesReceived(VotesReceivedCall),
        VotesUsed(VotesUsedCall),
        VotingDelay(VotingDelayCall),
        VotingPeriod(VotingPeriodCall),
    }
    impl ::ethers::core::abi::AbiDecode for RindexerArbitrumSCNominationsGenCalls {
        fn decode(data: impl AsRef<[u8]>) -> ::core::result::Result<Self, ::ethers::core::abi::AbiError> {
            let data = data.as_ref();
            if let Ok(decoded) = <BallotTypehashCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::BallotTypehash(decoded));
            }
            if let Ok(decoded) = <CountingModeCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CountingMode(decoded));
            }
            if let Ok(decoded) = <ExcludeAddressCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ExcludeAddress(decoded));
            }
            if let Ok(decoded) = <ExtendedBallotTypehashCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ExtendedBallotTypehash(decoded));
            }
            if let Ok(decoded) = <AddContenderCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::AddContender(decoded));
            }
            if let Ok(decoded) = <AddContenderWithProposalIdCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::AddContenderWithProposalId(decoded));
            }
            if let Ok(decoded) = <CastVoteCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CastVote(decoded));
            }
            if let Ok(decoded) = <CastVoteBySigCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CastVoteBySig(decoded));
            }
            if let Ok(decoded) = <CastVoteWithReasonCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CastVoteWithReason(decoded));
            }
            if let Ok(decoded) = <CastVoteWithReasonAndParamsCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CastVoteWithReasonAndParams(decoded));
            }
            if let Ok(decoded) = <CastVoteWithReasonAndParamsBySigCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CastVoteWithReasonAndParamsBySig(decoded));
            }
            if let Ok(decoded) = <CompliantNomineeCountCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CompliantNomineeCount(decoded));
            }
            if let Ok(decoded) = <CompliantNomineesCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CompliantNominees(decoded));
            }
            if let Ok(decoded) = <CreateElectionCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CreateElection(decoded));
            }
            if let Ok(decoded) = <CurrentCohortCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::CurrentCohort(decoded));
            }
            if let Ok(decoded) = <ElectionCountCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ElectionCount(decoded));
            }
            if let Ok(decoded) = <ElectionIndexToCohortCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ElectionIndexToCohort(decoded));
            }
            if let Ok(decoded) = <ElectionIndexToDescriptionCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ElectionIndexToDescription(decoded));
            }
            if let Ok(decoded) = <ElectionToTimestampCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ElectionToTimestamp(decoded));
            }
            if let Ok(decoded) = <ExcludeNomineeCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ExcludeNominee(decoded));
            }
            if let Ok(decoded) = <ExcludedNomineeCountCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ExcludedNomineeCount(decoded));
            }
            if let Ok(decoded) = <ExecuteCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Execute(decoded));
            }
            if let Ok(decoded) = <FirstNominationStartDateCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::FirstNominationStartDate(decoded));
            }
            if let Ok(decoded) = <GetPastCirculatingSupplyCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::GetPastCirculatingSupply(decoded));
            }
            if let Ok(decoded) = <GetProposeArgsCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::GetProposeArgs(decoded));
            }
            if let Ok(decoded) = <GetVotesCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::GetVotes(decoded));
            }
            if let Ok(decoded) = <GetVotesWithParamsCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::GetVotesWithParams(decoded));
            }
            if let Ok(decoded) = <HasVotedCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::HasVoted(decoded));
            }
            if let Ok(decoded) = <HashProposalCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::HashProposal(decoded));
            }
            if let Ok(decoded) = <IncludeNomineeCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::IncludeNominee(decoded));
            }
            if let Ok(decoded) = <InitializeCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Initialize(decoded));
            }
            if let Ok(decoded) = <IsCompliantNomineeCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::IsCompliantNominee(decoded));
            }
            if let Ok(decoded) = <IsContenderCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::IsContender(decoded));
            }
            if let Ok(decoded) = <IsExcludedCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::IsExcluded(decoded));
            }
            if let Ok(decoded) = <IsNomineeCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::IsNominee(decoded));
            }
            if let Ok(decoded) = <NameCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Name(decoded));
            }
            if let Ok(decoded) = <NomineeCountCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::NomineeCount(decoded));
            }
            if let Ok(decoded) = <NomineeVetterCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::NomineeVetter(decoded));
            }
            if let Ok(decoded) = <NomineeVettingDurationCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::NomineeVettingDuration(decoded));
            }
            if let Ok(decoded) = <NomineesCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Nominees(decoded));
            }
            if let Ok(decoded) = <OnERC1155BatchReceivedCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::OnERC1155BatchReceived(decoded));
            }
            if let Ok(decoded) = <OnERC1155ReceivedCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::OnERC1155Received(decoded));
            }
            if let Ok(decoded) = <OnERC721ReceivedCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::OnERC721Received(decoded));
            }
            if let Ok(decoded) = <OtherCohortCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::OtherCohort(decoded));
            }
            if let Ok(decoded) = <OwnerCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Owner(decoded));
            }
            if let Ok(decoded) = <ProposalDeadlineCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalDeadline(decoded));
            }
            if let Ok(decoded) = <ProposalSnapshotCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalSnapshot(decoded));
            }
            if let Ok(decoded) = <ProposalThresholdCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalThreshold(decoded));
            }
            if let Ok(decoded) = <ProposalVettingDeadlineCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalVettingDeadline(decoded));
            }
            if let Ok(decoded) = <ProposeCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Propose(decoded));
            }
            if let Ok(decoded) = <QuorumCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Quorum(decoded));
            }
            if let Ok(decoded) = <QuorumDenominatorCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::QuorumDenominator(decoded));
            }
            if let Ok(decoded) = <QuorumNumeratorWithBlockNumberCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::QuorumNumeratorWithBlockNumber(decoded));
            }
            if let Ok(decoded) = <QuorumNumeratorCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::QuorumNumerator(decoded));
            }
            if let Ok(decoded) = <RecoverAddContenderMessageCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::RecoverAddContenderMessage(decoded));
            }
            if let Ok(decoded) = <RelayCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Relay(decoded));
            }
            if let Ok(decoded) = <RenounceOwnershipCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::RenounceOwnership(decoded));
            }
            if let Ok(decoded) = <SecurityCouncilManagerCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::SecurityCouncilManager(decoded));
            }
            if let Ok(decoded) = <SecurityCouncilMemberElectionGovernorCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::SecurityCouncilMemberElectionGovernor(decoded));
            }
            if let Ok(decoded) = <SetNomineeVetterCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::SetNomineeVetter(decoded));
            }
            if let Ok(decoded) = <SetProposalThresholdCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::SetProposalThreshold(decoded));
            }
            if let Ok(decoded) = <SetVotingDelayCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::SetVotingDelay(decoded));
            }
            if let Ok(decoded) = <SetVotingPeriodCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::SetVotingPeriod(decoded));
            }
            if let Ok(decoded) = <StateCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::State(decoded));
            }
            if let Ok(decoded) = <SupportsInterfaceCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::SupportsInterface(decoded));
            }
            if let Ok(decoded) = <TokenCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Token(decoded));
            }
            if let Ok(decoded) = <TransferOwnershipCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::TransferOwnership(decoded));
            }
            if let Ok(decoded) = <UpdateQuorumNumeratorCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::UpdateQuorumNumerator(decoded));
            }
            if let Ok(decoded) = <UsedNoncesCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::UsedNonces(decoded));
            }
            if let Ok(decoded) = <VersionCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Version(decoded));
            }
            if let Ok(decoded) = <VotesReceivedCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::VotesReceived(decoded));
            }
            if let Ok(decoded) = <VotesUsedCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::VotesUsed(decoded));
            }
            if let Ok(decoded) = <VotingDelayCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::VotingDelay(decoded));
            }
            if let Ok(decoded) = <VotingPeriodCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::VotingPeriod(decoded));
            }
            Err(::ethers::core::abi::Error::InvalidData.into())
        }
    }
    impl ::ethers::core::abi::AbiEncode for RindexerArbitrumSCNominationsGenCalls {
        fn encode(self) -> Vec<u8> {
            match self {
                Self::BallotTypehash(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CountingMode(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ExcludeAddress(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ExtendedBallotTypehash(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::AddContender(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::AddContenderWithProposalId(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVote(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVoteBySig(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVoteWithReason(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVoteWithReasonAndParams(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVoteWithReasonAndParamsBySig(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CompliantNomineeCount(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CompliantNominees(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CreateElection(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CurrentCohort(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ElectionCount(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ElectionIndexToCohort(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ElectionIndexToDescription(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ElectionToTimestamp(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ExcludeNominee(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ExcludedNomineeCount(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Execute(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::FirstNominationStartDate(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::GetPastCirculatingSupply(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::GetProposeArgs(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::GetVotes(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::GetVotesWithParams(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::HasVoted(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::HashProposal(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::IncludeNominee(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Initialize(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::IsCompliantNominee(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::IsContender(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::IsExcluded(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::IsNominee(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Name(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::NomineeCount(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::NomineeVetter(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::NomineeVettingDuration(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Nominees(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::OnERC1155BatchReceived(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::OnERC1155Received(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::OnERC721Received(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::OtherCohort(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Owner(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalDeadline(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalSnapshot(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalThreshold(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalVettingDeadline(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Propose(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Quorum(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::QuorumDenominator(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::QuorumNumeratorWithBlockNumber(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::QuorumNumerator(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::RecoverAddContenderMessage(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Relay(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::RenounceOwnership(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SecurityCouncilManager(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SecurityCouncilMemberElectionGovernor(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SetNomineeVetter(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SetProposalThreshold(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SetVotingDelay(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SetVotingPeriod(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::State(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SupportsInterface(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Token(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::TransferOwnership(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::UpdateQuorumNumerator(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::UsedNonces(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Version(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::VotesReceived(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::VotesUsed(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::VotingDelay(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::VotingPeriod(element) => ::ethers::core::abi::AbiEncode::encode(element),
            }
        }
    }
    impl ::core::fmt::Display for RindexerArbitrumSCNominationsGenCalls {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
            match self {
                Self::BallotTypehash(element) => ::core::fmt::Display::fmt(element, f),
                Self::CountingMode(element) => ::core::fmt::Display::fmt(element, f),
                Self::ExcludeAddress(element) => ::core::fmt::Display::fmt(element, f),
                Self::ExtendedBallotTypehash(element) => ::core::fmt::Display::fmt(element, f),
                Self::AddContender(element) => ::core::fmt::Display::fmt(element, f),
                Self::AddContenderWithProposalId(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVote(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVoteBySig(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVoteWithReason(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVoteWithReasonAndParams(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVoteWithReasonAndParamsBySig(element) => ::core::fmt::Display::fmt(element, f),
                Self::CompliantNomineeCount(element) => ::core::fmt::Display::fmt(element, f),
                Self::CompliantNominees(element) => ::core::fmt::Display::fmt(element, f),
                Self::CreateElection(element) => ::core::fmt::Display::fmt(element, f),
                Self::CurrentCohort(element) => ::core::fmt::Display::fmt(element, f),
                Self::ElectionCount(element) => ::core::fmt::Display::fmt(element, f),
                Self::ElectionIndexToCohort(element) => ::core::fmt::Display::fmt(element, f),
                Self::ElectionIndexToDescription(element) => ::core::fmt::Display::fmt(element, f),
                Self::ElectionToTimestamp(element) => ::core::fmt::Display::fmt(element, f),
                Self::ExcludeNominee(element) => ::core::fmt::Display::fmt(element, f),
                Self::ExcludedNomineeCount(element) => ::core::fmt::Display::fmt(element, f),
                Self::Execute(element) => ::core::fmt::Display::fmt(element, f),
                Self::FirstNominationStartDate(element) => ::core::fmt::Display::fmt(element, f),
                Self::GetPastCirculatingSupply(element) => ::core::fmt::Display::fmt(element, f),
                Self::GetProposeArgs(element) => ::core::fmt::Display::fmt(element, f),
                Self::GetVotes(element) => ::core::fmt::Display::fmt(element, f),
                Self::GetVotesWithParams(element) => ::core::fmt::Display::fmt(element, f),
                Self::HasVoted(element) => ::core::fmt::Display::fmt(element, f),
                Self::HashProposal(element) => ::core::fmt::Display::fmt(element, f),
                Self::IncludeNominee(element) => ::core::fmt::Display::fmt(element, f),
                Self::Initialize(element) => ::core::fmt::Display::fmt(element, f),
                Self::IsCompliantNominee(element) => ::core::fmt::Display::fmt(element, f),
                Self::IsContender(element) => ::core::fmt::Display::fmt(element, f),
                Self::IsExcluded(element) => ::core::fmt::Display::fmt(element, f),
                Self::IsNominee(element) => ::core::fmt::Display::fmt(element, f),
                Self::Name(element) => ::core::fmt::Display::fmt(element, f),
                Self::NomineeCount(element) => ::core::fmt::Display::fmt(element, f),
                Self::NomineeVetter(element) => ::core::fmt::Display::fmt(element, f),
                Self::NomineeVettingDuration(element) => ::core::fmt::Display::fmt(element, f),
                Self::Nominees(element) => ::core::fmt::Display::fmt(element, f),
                Self::OnERC1155BatchReceived(element) => ::core::fmt::Display::fmt(element, f),
                Self::OnERC1155Received(element) => ::core::fmt::Display::fmt(element, f),
                Self::OnERC721Received(element) => ::core::fmt::Display::fmt(element, f),
                Self::OtherCohort(element) => ::core::fmt::Display::fmt(element, f),
                Self::Owner(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalDeadline(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalSnapshot(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalThreshold(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalVettingDeadline(element) => ::core::fmt::Display::fmt(element, f),
                Self::Propose(element) => ::core::fmt::Display::fmt(element, f),
                Self::Quorum(element) => ::core::fmt::Display::fmt(element, f),
                Self::QuorumDenominator(element) => ::core::fmt::Display::fmt(element, f),
                Self::QuorumNumeratorWithBlockNumber(element) => ::core::fmt::Display::fmt(element, f),
                Self::QuorumNumerator(element) => ::core::fmt::Display::fmt(element, f),
                Self::RecoverAddContenderMessage(element) => ::core::fmt::Display::fmt(element, f),
                Self::Relay(element) => ::core::fmt::Display::fmt(element, f),
                Self::RenounceOwnership(element) => ::core::fmt::Display::fmt(element, f),
                Self::SecurityCouncilManager(element) => ::core::fmt::Display::fmt(element, f),
                Self::SecurityCouncilMemberElectionGovernor(element) => ::core::fmt::Display::fmt(element, f),
                Self::SetNomineeVetter(element) => ::core::fmt::Display::fmt(element, f),
                Self::SetProposalThreshold(element) => ::core::fmt::Display::fmt(element, f),
                Self::SetVotingDelay(element) => ::core::fmt::Display::fmt(element, f),
                Self::SetVotingPeriod(element) => ::core::fmt::Display::fmt(element, f),
                Self::State(element) => ::core::fmt::Display::fmt(element, f),
                Self::SupportsInterface(element) => ::core::fmt::Display::fmt(element, f),
                Self::Token(element) => ::core::fmt::Display::fmt(element, f),
                Self::TransferOwnership(element) => ::core::fmt::Display::fmt(element, f),
                Self::UpdateQuorumNumerator(element) => ::core::fmt::Display::fmt(element, f),
                Self::UsedNonces(element) => ::core::fmt::Display::fmt(element, f),
                Self::Version(element) => ::core::fmt::Display::fmt(element, f),
                Self::VotesReceived(element) => ::core::fmt::Display::fmt(element, f),
                Self::VotesUsed(element) => ::core::fmt::Display::fmt(element, f),
                Self::VotingDelay(element) => ::core::fmt::Display::fmt(element, f),
                Self::VotingPeriod(element) => ::core::fmt::Display::fmt(element, f),
            }
        }
    }
    impl ::core::convert::From<BallotTypehashCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: BallotTypehashCall) -> Self {
            Self::BallotTypehash(value)
        }
    }
    impl ::core::convert::From<CountingModeCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: CountingModeCall) -> Self {
            Self::CountingMode(value)
        }
    }
    impl ::core::convert::From<ExcludeAddressCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ExcludeAddressCall) -> Self {
            Self::ExcludeAddress(value)
        }
    }
    impl ::core::convert::From<ExtendedBallotTypehashCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ExtendedBallotTypehashCall) -> Self {
            Self::ExtendedBallotTypehash(value)
        }
    }
    impl ::core::convert::From<AddContenderCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: AddContenderCall) -> Self {
            Self::AddContender(value)
        }
    }
    impl ::core::convert::From<AddContenderWithProposalIdCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: AddContenderWithProposalIdCall) -> Self {
            Self::AddContenderWithProposalId(value)
        }
    }
    impl ::core::convert::From<CastVoteCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: CastVoteCall) -> Self {
            Self::CastVote(value)
        }
    }
    impl ::core::convert::From<CastVoteBySigCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: CastVoteBySigCall) -> Self {
            Self::CastVoteBySig(value)
        }
    }
    impl ::core::convert::From<CastVoteWithReasonCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: CastVoteWithReasonCall) -> Self {
            Self::CastVoteWithReason(value)
        }
    }
    impl ::core::convert::From<CastVoteWithReasonAndParamsCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: CastVoteWithReasonAndParamsCall) -> Self {
            Self::CastVoteWithReasonAndParams(value)
        }
    }
    impl ::core::convert::From<CastVoteWithReasonAndParamsBySigCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: CastVoteWithReasonAndParamsBySigCall) -> Self {
            Self::CastVoteWithReasonAndParamsBySig(value)
        }
    }
    impl ::core::convert::From<CompliantNomineeCountCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: CompliantNomineeCountCall) -> Self {
            Self::CompliantNomineeCount(value)
        }
    }
    impl ::core::convert::From<CompliantNomineesCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: CompliantNomineesCall) -> Self {
            Self::CompliantNominees(value)
        }
    }
    impl ::core::convert::From<CreateElectionCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: CreateElectionCall) -> Self {
            Self::CreateElection(value)
        }
    }
    impl ::core::convert::From<CurrentCohortCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: CurrentCohortCall) -> Self {
            Self::CurrentCohort(value)
        }
    }
    impl ::core::convert::From<ElectionCountCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ElectionCountCall) -> Self {
            Self::ElectionCount(value)
        }
    }
    impl ::core::convert::From<ElectionIndexToCohortCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ElectionIndexToCohortCall) -> Self {
            Self::ElectionIndexToCohort(value)
        }
    }
    impl ::core::convert::From<ElectionIndexToDescriptionCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ElectionIndexToDescriptionCall) -> Self {
            Self::ElectionIndexToDescription(value)
        }
    }
    impl ::core::convert::From<ElectionToTimestampCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ElectionToTimestampCall) -> Self {
            Self::ElectionToTimestamp(value)
        }
    }
    impl ::core::convert::From<ExcludeNomineeCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ExcludeNomineeCall) -> Self {
            Self::ExcludeNominee(value)
        }
    }
    impl ::core::convert::From<ExcludedNomineeCountCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ExcludedNomineeCountCall) -> Self {
            Self::ExcludedNomineeCount(value)
        }
    }
    impl ::core::convert::From<ExecuteCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ExecuteCall) -> Self {
            Self::Execute(value)
        }
    }
    impl ::core::convert::From<FirstNominationStartDateCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: FirstNominationStartDateCall) -> Self {
            Self::FirstNominationStartDate(value)
        }
    }
    impl ::core::convert::From<GetPastCirculatingSupplyCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: GetPastCirculatingSupplyCall) -> Self {
            Self::GetPastCirculatingSupply(value)
        }
    }
    impl ::core::convert::From<GetProposeArgsCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: GetProposeArgsCall) -> Self {
            Self::GetProposeArgs(value)
        }
    }
    impl ::core::convert::From<GetVotesCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: GetVotesCall) -> Self {
            Self::GetVotes(value)
        }
    }
    impl ::core::convert::From<GetVotesWithParamsCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: GetVotesWithParamsCall) -> Self {
            Self::GetVotesWithParams(value)
        }
    }
    impl ::core::convert::From<HasVotedCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: HasVotedCall) -> Self {
            Self::HasVoted(value)
        }
    }
    impl ::core::convert::From<HashProposalCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: HashProposalCall) -> Self {
            Self::HashProposal(value)
        }
    }
    impl ::core::convert::From<IncludeNomineeCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: IncludeNomineeCall) -> Self {
            Self::IncludeNominee(value)
        }
    }
    impl ::core::convert::From<InitializeCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: InitializeCall) -> Self {
            Self::Initialize(value)
        }
    }
    impl ::core::convert::From<IsCompliantNomineeCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: IsCompliantNomineeCall) -> Self {
            Self::IsCompliantNominee(value)
        }
    }
    impl ::core::convert::From<IsContenderCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: IsContenderCall) -> Self {
            Self::IsContender(value)
        }
    }
    impl ::core::convert::From<IsExcludedCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: IsExcludedCall) -> Self {
            Self::IsExcluded(value)
        }
    }
    impl ::core::convert::From<IsNomineeCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: IsNomineeCall) -> Self {
            Self::IsNominee(value)
        }
    }
    impl ::core::convert::From<NameCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: NameCall) -> Self {
            Self::Name(value)
        }
    }
    impl ::core::convert::From<NomineeCountCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: NomineeCountCall) -> Self {
            Self::NomineeCount(value)
        }
    }
    impl ::core::convert::From<NomineeVetterCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: NomineeVetterCall) -> Self {
            Self::NomineeVetter(value)
        }
    }
    impl ::core::convert::From<NomineeVettingDurationCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: NomineeVettingDurationCall) -> Self {
            Self::NomineeVettingDuration(value)
        }
    }
    impl ::core::convert::From<NomineesCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: NomineesCall) -> Self {
            Self::Nominees(value)
        }
    }
    impl ::core::convert::From<OnERC1155BatchReceivedCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: OnERC1155BatchReceivedCall) -> Self {
            Self::OnERC1155BatchReceived(value)
        }
    }
    impl ::core::convert::From<OnERC1155ReceivedCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: OnERC1155ReceivedCall) -> Self {
            Self::OnERC1155Received(value)
        }
    }
    impl ::core::convert::From<OnERC721ReceivedCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: OnERC721ReceivedCall) -> Self {
            Self::OnERC721Received(value)
        }
    }
    impl ::core::convert::From<OtherCohortCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: OtherCohortCall) -> Self {
            Self::OtherCohort(value)
        }
    }
    impl ::core::convert::From<OwnerCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: OwnerCall) -> Self {
            Self::Owner(value)
        }
    }
    impl ::core::convert::From<ProposalDeadlineCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ProposalDeadlineCall) -> Self {
            Self::ProposalDeadline(value)
        }
    }
    impl ::core::convert::From<ProposalSnapshotCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ProposalSnapshotCall) -> Self {
            Self::ProposalSnapshot(value)
        }
    }
    impl ::core::convert::From<ProposalThresholdCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ProposalThresholdCall) -> Self {
            Self::ProposalThreshold(value)
        }
    }
    impl ::core::convert::From<ProposalVettingDeadlineCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ProposalVettingDeadlineCall) -> Self {
            Self::ProposalVettingDeadline(value)
        }
    }
    impl ::core::convert::From<ProposeCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: ProposeCall) -> Self {
            Self::Propose(value)
        }
    }
    impl ::core::convert::From<QuorumCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: QuorumCall) -> Self {
            Self::Quorum(value)
        }
    }
    impl ::core::convert::From<QuorumDenominatorCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: QuorumDenominatorCall) -> Self {
            Self::QuorumDenominator(value)
        }
    }
    impl ::core::convert::From<QuorumNumeratorWithBlockNumberCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: QuorumNumeratorWithBlockNumberCall) -> Self {
            Self::QuorumNumeratorWithBlockNumber(value)
        }
    }
    impl ::core::convert::From<QuorumNumeratorCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: QuorumNumeratorCall) -> Self {
            Self::QuorumNumerator(value)
        }
    }
    impl ::core::convert::From<RecoverAddContenderMessageCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: RecoverAddContenderMessageCall) -> Self {
            Self::RecoverAddContenderMessage(value)
        }
    }
    impl ::core::convert::From<RelayCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: RelayCall) -> Self {
            Self::Relay(value)
        }
    }
    impl ::core::convert::From<RenounceOwnershipCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: RenounceOwnershipCall) -> Self {
            Self::RenounceOwnership(value)
        }
    }
    impl ::core::convert::From<SecurityCouncilManagerCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: SecurityCouncilManagerCall) -> Self {
            Self::SecurityCouncilManager(value)
        }
    }
    impl ::core::convert::From<SecurityCouncilMemberElectionGovernorCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: SecurityCouncilMemberElectionGovernorCall) -> Self {
            Self::SecurityCouncilMemberElectionGovernor(value)
        }
    }
    impl ::core::convert::From<SetNomineeVetterCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: SetNomineeVetterCall) -> Self {
            Self::SetNomineeVetter(value)
        }
    }
    impl ::core::convert::From<SetProposalThresholdCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: SetProposalThresholdCall) -> Self {
            Self::SetProposalThreshold(value)
        }
    }
    impl ::core::convert::From<SetVotingDelayCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: SetVotingDelayCall) -> Self {
            Self::SetVotingDelay(value)
        }
    }
    impl ::core::convert::From<SetVotingPeriodCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: SetVotingPeriodCall) -> Self {
            Self::SetVotingPeriod(value)
        }
    }
    impl ::core::convert::From<StateCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: StateCall) -> Self {
            Self::State(value)
        }
    }
    impl ::core::convert::From<SupportsInterfaceCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: SupportsInterfaceCall) -> Self {
            Self::SupportsInterface(value)
        }
    }
    impl ::core::convert::From<TokenCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: TokenCall) -> Self {
            Self::Token(value)
        }
    }
    impl ::core::convert::From<TransferOwnershipCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: TransferOwnershipCall) -> Self {
            Self::TransferOwnership(value)
        }
    }
    impl ::core::convert::From<UpdateQuorumNumeratorCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: UpdateQuorumNumeratorCall) -> Self {
            Self::UpdateQuorumNumerator(value)
        }
    }
    impl ::core::convert::From<UsedNoncesCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: UsedNoncesCall) -> Self {
            Self::UsedNonces(value)
        }
    }
    impl ::core::convert::From<VersionCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: VersionCall) -> Self {
            Self::Version(value)
        }
    }
    impl ::core::convert::From<VotesReceivedCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: VotesReceivedCall) -> Self {
            Self::VotesReceived(value)
        }
    }
    impl ::core::convert::From<VotesUsedCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: VotesUsedCall) -> Self {
            Self::VotesUsed(value)
        }
    }
    impl ::core::convert::From<VotingDelayCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: VotingDelayCall) -> Self {
            Self::VotingDelay(value)
        }
    }
    impl ::core::convert::From<VotingPeriodCall> for RindexerArbitrumSCNominationsGenCalls {
        fn from(value: VotingPeriodCall) -> Self {
            Self::VotingPeriod(value)
        }
    }
    ///Container type for all return fields from the `BALLOT_TYPEHASH` function with signature `BALLOT_TYPEHASH()` and selector `0xdeaaa7cc`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct BallotTypehashReturn(pub [u8; 32]);
    ///Container type for all return fields from the `COUNTING_MODE` function with signature `COUNTING_MODE()` and selector `0xdd4e2ba5`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CountingModeReturn(pub ::std::string::String);
    ///Container type for all return fields from the `EXCLUDE_ADDRESS` function with signature `EXCLUDE_ADDRESS()` and selector `0x5e12ebbd`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ExcludeAddressReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `EXTENDED_BALLOT_TYPEHASH` function with signature `EXTENDED_BALLOT_TYPEHASH()` and selector `0x2fe3e261`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ExtendedBallotTypehashReturn(pub [u8; 32]);
    ///Container type for all return fields from the `castVote` function with signature `castVote(uint256,uint8)` and selector `0x56781388`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CastVoteReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `castVoteBySig` function with signature `castVoteBySig(uint256,uint8,uint8,bytes32,bytes32)` and selector `0x3bccf4fd`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CastVoteBySigReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `castVoteWithReason` function with signature `castVoteWithReason(uint256,uint8,string)` and selector `0x7b3c71d3`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CastVoteWithReasonReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `castVoteWithReasonAndParams` function with signature `castVoteWithReasonAndParams(uint256,uint8,string,bytes)` and selector `0x5f398a14`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CastVoteWithReasonAndParamsReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `castVoteWithReasonAndParamsBySig` function with signature `castVoteWithReasonAndParamsBySig(uint256,uint8,string,bytes,uint8,bytes32,bytes32)` and selector `0x03420181`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CastVoteWithReasonAndParamsBySigReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `compliantNomineeCount` function with signature `compliantNomineeCount(uint256)` and selector `0xe0c11ff6`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CompliantNomineeCountReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `compliantNominees` function with signature `compliantNominees(uint256)` and selector `0xf3dfd61c`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CompliantNomineesReturn(pub ::std::vec::Vec<::ethers::core::types::Address>);
    ///Container type for all return fields from the `createElection` function with signature `createElection()` and selector `0x24c2286c`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CreateElectionReturn {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all return fields from the `currentCohort` function with signature `currentCohort()` and selector `0xe0f9c970`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CurrentCohortReturn(pub u8);
    ///Container type for all return fields from the `electionCount` function with signature `electionCount()` and selector `0x997d2830`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ElectionCountReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `electionIndexToCohort` function with signature `electionIndexToCohort(uint256)` and selector `0x33bb6f4b`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ElectionIndexToCohortReturn(pub u8);
    ///Container type for all return fields from the `electionIndexToDescription` function with signature `electionIndexToDescription(uint256)` and selector `0x276ae91a`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ElectionIndexToDescriptionReturn(pub ::std::string::String);
    ///Container type for all return fields from the `electionToTimestamp` function with signature `electionToTimestamp(uint256)` and selector `0xc2192dc1`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ElectionToTimestampReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `excludedNomineeCount` function with signature `excludedNomineeCount(uint256)` and selector `0xb0ee63f2`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ExcludedNomineeCountReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `execute` function with signature `execute(address[],uint256[],bytes[],bytes32)` and selector `0x2656227d`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ExecuteReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `firstNominationStartDate` function with signature `firstNominationStartDate()` and selector `0xbeb28536`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct FirstNominationStartDateReturn {
        pub year: ::ethers::core::types::U256,
        pub month: ::ethers::core::types::U256,
        pub day: ::ethers::core::types::U256,
        pub hour: ::ethers::core::types::U256,
    }
    ///Container type for all return fields from the `getPastCirculatingSupply` function with signature `getPastCirculatingSupply(uint256)` and selector `0x6e462680`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct GetPastCirculatingSupplyReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `getProposeArgs` function with signature `getProposeArgs(uint256)` and selector `0x1f0ac182`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct GetProposeArgsReturn(
        pub ::std::vec::Vec<::ethers::core::types::Address>,
        pub ::std::vec::Vec<::ethers::core::types::U256>,
        pub ::std::vec::Vec<::ethers::core::types::Bytes>,
        pub ::std::string::String,
    );
    ///Container type for all return fields from the `getVotes` function with signature `getVotes(address,uint256)` and selector `0xeb9019d4`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct GetVotesReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `getVotesWithParams` function with signature `getVotesWithParams(address,uint256,bytes)` and selector `0x9a802a6d`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct GetVotesWithParamsReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `hasVoted` function with signature `hasVoted(uint256,address)` and selector `0x43859632`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct HasVotedReturn(pub bool);
    ///Container type for all return fields from the `hashProposal` function with signature `hashProposal(address[],uint256[],bytes[],bytes32)` and selector `0xc59057e4`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct HashProposalReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `isCompliantNominee` function with signature `isCompliantNominee(uint256,address)` and selector `0xc16e0ec6`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct IsCompliantNomineeReturn(pub bool);
    ///Container type for all return fields from the `isContender` function with signature `isContender(uint256,address)` and selector `0xeba4b237`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct IsContenderReturn(pub bool);
    ///Container type for all return fields from the `isExcluded` function with signature `isExcluded(uint256,address)` and selector `0x3b158390`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct IsExcludedReturn(pub bool);
    ///Container type for all return fields from the `isNominee` function with signature `isNominee(uint256,address)` and selector `0x7d60af91`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct IsNomineeReturn(pub bool);
    ///Container type for all return fields from the `name` function with signature `name()` and selector `0x06fdde03`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct NameReturn(pub ::std::string::String);
    ///Container type for all return fields from the `nomineeCount` function with signature `nomineeCount(uint256)` and selector `0xe63f88a8`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct NomineeCountReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `nomineeVetter` function with signature `nomineeVetter()` and selector `0x0298ad49`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct NomineeVetterReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `nomineeVettingDuration` function with signature `nomineeVettingDuration()` and selector `0x45110965`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct NomineeVettingDurationReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `nominees` function with signature `nominees(uint256)` and selector `0xeec6b91e`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct NomineesReturn(pub ::std::vec::Vec<::ethers::core::types::Address>);
    ///Container type for all return fields from the `onERC1155BatchReceived` function with signature `onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)` and selector `0xbc197c81`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct OnERC1155BatchReceivedReturn(pub [u8; 4]);
    ///Container type for all return fields from the `onERC1155Received` function with signature `onERC1155Received(address,address,uint256,uint256,bytes)` and selector `0xf23a6e61`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct OnERC1155ReceivedReturn(pub [u8; 4]);
    ///Container type for all return fields from the `onERC721Received` function with signature `onERC721Received(address,address,uint256,bytes)` and selector `0x150b7a02`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct OnERC721ReceivedReturn(pub [u8; 4]);
    ///Container type for all return fields from the `otherCohort` function with signature `otherCohort()` and selector `0xcf5d27c4`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct OtherCohortReturn(pub u8);
    ///Container type for all return fields from the `owner` function with signature `owner()` and selector `0x8da5cb5b`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct OwnerReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `proposalDeadline` function with signature `proposalDeadline(uint256)` and selector `0xc01f9e37`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposalDeadlineReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `proposalSnapshot` function with signature `proposalSnapshot(uint256)` and selector `0x2d63f693`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposalSnapshotReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `proposalThreshold` function with signature `proposalThreshold()` and selector `0xb58131b0`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposalThresholdReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `proposalVettingDeadline` function with signature `proposalVettingDeadline(uint256)` and selector `0x2df2c649`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposalVettingDeadlineReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `propose` function with signature `propose(address[],uint256[],bytes[],string)` and selector `0x7d5e81e2`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposeReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `quorum` function with signature `quorum(uint256)` and selector `0xf8ce560a`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct QuorumReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `quorumDenominator` function with signature `quorumDenominator()` and selector `0x97c3d334`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct QuorumDenominatorReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `quorumNumerator` function with signature `quorumNumerator(uint256)` and selector `0x60c4247f`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct QuorumNumeratorWithBlockNumberReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `quorumNumerator` function with signature `quorumNumerator()` and selector `0xa7713a70`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct QuorumNumeratorReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `recoverAddContenderMessage` function with signature `recoverAddContenderMessage(uint256,bytes)` and selector `0x5a756eaf`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct RecoverAddContenderMessageReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `securityCouncilManager` function with signature `securityCouncilManager()` and selector `0x03d1ce8a`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct SecurityCouncilManagerReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `securityCouncilMemberElectionGovernor` function with signature `securityCouncilMemberElectionGovernor()` and selector `0x1b6a7673`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct SecurityCouncilMemberElectionGovernorReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `state` function with signature `state(uint256)` and selector `0x3e4f49e6`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct StateReturn(pub u8);
    ///Container type for all return fields from the `supportsInterface` function with signature `supportsInterface(bytes4)` and selector `0x01ffc9a7`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct SupportsInterfaceReturn(pub bool);
    ///Container type for all return fields from the `token` function with signature `token()` and selector `0xfc0c546a`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct TokenReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `usedNonces` function with signature `usedNonces(bytes32)` and selector `0xfeb61724`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct UsedNoncesReturn(pub bool);
    ///Container type for all return fields from the `version` function with signature `version()` and selector `0x54fd4d50`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct VersionReturn(pub ::std::string::String);
    ///Container type for all return fields from the `votesReceived` function with signature `votesReceived(uint256,address)` and selector `0x33dd6bed`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct VotesReceivedReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `votesUsed` function with signature `votesUsed(uint256,address)` and selector `0x9523730e`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct VotesUsedReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `votingDelay` function with signature `votingDelay()` and selector `0x3932abb1`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct VotingDelayReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `votingPeriod` function with signature `votingPeriod()` and selector `0x02a251a3`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct VotingPeriodReturn(pub ::ethers::core::types::U256);
    ///`Date(uint256,uint256,uint256,uint256)`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct Date {
        pub year: ::ethers::core::types::U256,
        pub month: ::ethers::core::types::U256,
        pub day: ::ethers::core::types::U256,
        pub hour: ::ethers::core::types::U256,
    }
    ///`InitParams((uint256,uint256,uint256,uint256),uint256,address,address,address,address,address,uint256,uint256)`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct InitParams {
        pub first_nomination_start_date: Date,
        pub nominee_vetting_duration: ::ethers::core::types::U256,
        pub nominee_vetter: ::ethers::core::types::Address,
        pub security_council_manager: ::ethers::core::types::Address,
        pub security_council_member_election_governor: ::ethers::core::types::Address,
        pub token: ::ethers::core::types::Address,
        pub owner: ::ethers::core::types::Address,
        pub quorum_numerator_value: ::ethers::core::types::U256,
        pub voting_period: ::ethers::core::types::U256,
    }
}
