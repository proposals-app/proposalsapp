pub use rindexer_arbitrum_treasury_governor_gen::*;
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
pub mod rindexer_arbitrum_treasury_governor_gen {
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
                    ::std::borrow::ToOwned::to_owned("castVote"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("castVote"),
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
                    ::std::borrow::ToOwned::to_owned("castVoteWithReason"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("castVoteWithReason"),
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
                    ::std::borrow::ToOwned::to_owned("initialize"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("initialize"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("_token"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned(
                                    "contract IVotesUpgradeable",
                                ),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("_timelock"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned(
                                    "contract TimelockControllerUpgradeable",
                                ),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("_owner"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("address"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("_votingDelay"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("_votingPeriod"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("_quorumNumerator"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("_proposalThreshold",),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("_minPeriodAfterQuorum",),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(64usize),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint64"),),
                            },
                        ],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("lateQuorumVoteExtension"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("lateQuorumVoteExtension",),
                        inputs: ::std::vec![],
                        outputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::string::String::new(),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(64usize),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint64"),),
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
                    ::std::borrow::ToOwned::to_owned("proposalEta"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("proposalEta"),
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
                    ::std::borrow::ToOwned::to_owned("proposalVotes"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("proposalVotes"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("proposalId"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                        },],
                        outputs: ::std::vec![
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("againstVotes"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("forVotes"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                            ::ethers::core::abi::ethabi::Param {
                                name: ::std::borrow::ToOwned::to_owned("abstainVotes"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint256"),),
                            },
                        ],
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
                                name: ::std::borrow::ToOwned::to_owned("description"),
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
                    ::std::borrow::ToOwned::to_owned("queue"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("queue"),
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
                    ::std::borrow::ToOwned::to_owned("setLateQuorumVoteExtension"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("setLateQuorumVoteExtension",),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("newVoteExtension"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Uint(64usize),
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned("uint64"),),
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
                    ::std::borrow::ToOwned::to_owned("timelock"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("timelock"),
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
                    ::std::borrow::ToOwned::to_owned("updateTimelock"),
                    ::std::vec![::ethers::core::abi::ethabi::Function {
                        name: ::std::borrow::ToOwned::to_owned("updateTimelock"),
                        inputs: ::std::vec![::ethers::core::abi::ethabi::Param {
                            name: ::std::borrow::ToOwned::to_owned("newTimelock"),
                            kind: ::ethers::core::abi::ethabi::ParamType::Address,
                            internal_type: ::core::option::Option::Some(::std::borrow::ToOwned::to_owned(
                                "contract TimelockControllerUpgradeable",
                            ),),
                        },],
                        outputs: ::std::vec![],
                        constant: ::core::option::Option::None,
                        state_mutability: ::ethers::core::abi::ethabi::StateMutability::NonPayable,
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
                    ::std::borrow::ToOwned::to_owned("LateQuorumVoteExtensionSet"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("LateQuorumVoteExtensionSet",),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("oldVoteExtension"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(64usize),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("newVoteExtension"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(64usize),
                                indexed: false,
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
                    ::std::borrow::ToOwned::to_owned("ProposalExtended"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("ProposalExtended"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: true,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("extendedDeadline"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(64usize),
                                indexed: false,
                            },
                        ],
                        anonymous: false,
                    },],
                ),
                (
                    ::std::borrow::ToOwned::to_owned("ProposalQueued"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("ProposalQueued"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("proposalId"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("eta"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Uint(256usize,),
                                indexed: false,
                            },
                        ],
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
                    ::std::borrow::ToOwned::to_owned("TimelockChange"),
                    ::std::vec![::ethers::core::abi::ethabi::Event {
                        name: ::std::borrow::ToOwned::to_owned("TimelockChange"),
                        inputs: ::std::vec![
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("oldTimelock"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
                                indexed: false,
                            },
                            ::ethers::core::abi::ethabi::EventParam {
                                name: ::std::borrow::ToOwned::to_owned("newTimelock"),
                                kind: ::ethers::core::abi::ethabi::ParamType::Address,
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
            errors: ::core::convert::From::from([(
                ::std::borrow::ToOwned::to_owned("Empty"),
                ::std::vec![::ethers::core::abi::ethabi::AbiError {
                    name: ::std::borrow::ToOwned::to_owned("Empty"),
                    inputs: ::std::vec![],
                },],
            )]),
            receive: true,
            fallback: false,
        }
    }
    ///The parsed JSON ABI of the contract.
    pub static RINDEXERARBITRUMTREASURYGOVERNORGEN_ABI: ::ethers::contract::Lazy<::ethers::core::abi::Abi> = ::ethers::contract::Lazy::new(__abi);
    pub struct RindexerArbitrumTreasuryGovernorGen<M>(::ethers::contract::Contract<M>);
    impl<M> ::core::clone::Clone for RindexerArbitrumTreasuryGovernorGen<M> {
        fn clone(&self) -> Self {
            Self(::core::clone::Clone::clone(&self.0))
        }
    }
    impl<M> ::core::ops::Deref for RindexerArbitrumTreasuryGovernorGen<M> {
        type Target = ::ethers::contract::Contract<M>;
        fn deref(&self) -> &Self::Target {
            &self.0
        }
    }
    impl<M> ::core::ops::DerefMut for RindexerArbitrumTreasuryGovernorGen<M> {
        fn deref_mut(&mut self) -> &mut Self::Target {
            &mut self.0
        }
    }
    impl<M> ::core::fmt::Debug for RindexerArbitrumTreasuryGovernorGen<M> {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
            f.debug_tuple(::core::stringify!(RindexerArbitrumTreasuryGovernorGen))
                .field(&self.address())
                .finish()
        }
    }
    impl<M: ::ethers::providers::Middleware> RindexerArbitrumTreasuryGovernorGen<M> {
        /// Creates a new contract instance with the specified `ethers` client at
        /// `address`. The contract derefs to a `ethers::Contract` object.
        pub fn new<T: Into<::ethers::core::types::Address>>(address: T, client: ::std::sync::Arc<M>) -> Self {
            Self(::ethers::contract::Contract::new(
                address.into(),
                RINDEXERARBITRUMTREASURYGOVERNORGEN_ABI.clone(),
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
        ///Calls the contract's `castVote` (0x56781388) function
        pub fn cast_vote(&self, proposal_id: ::ethers::core::types::U256, support: u8) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([86, 120, 19, 136], (proposal_id, support))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `castVoteBySig` (0x3bccf4fd) function
        pub fn cast_vote_by_sig(&self, proposal_id: ::ethers::core::types::U256, support: u8, v: u8, r: [u8; 32], s: [u8; 32]) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([59, 204, 244, 253], (proposal_id, support, v, r, s))
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `castVoteWithReason` (0x7b3c71d3) function
        pub fn cast_vote_with_reason(&self, proposal_id: ::ethers::core::types::U256, support: u8, reason: ::std::string::String) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([123, 60, 113, 211], (proposal_id, support, reason))
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
        ///Calls the contract's `execute` (0x2656227d) function
        pub fn execute(&self, targets: ::std::vec::Vec<::ethers::core::types::Address>, values: ::std::vec::Vec<::ethers::core::types::U256>, calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>, description_hash: [u8; 32]) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash(
                    [38, 86, 34, 125],
                    (targets, values, calldatas, description_hash),
                )
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `getPastCirculatingSupply` (0x6e462680) function
        pub fn get_past_circulating_supply(&self, block_number: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([110, 70, 38, 128], block_number)
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
        ///Calls the contract's `initialize` (0x5b447a57) function
        pub fn initialize(&self, token: ::ethers::core::types::Address, timelock: ::ethers::core::types::Address, owner: ::ethers::core::types::Address, voting_delay: ::ethers::core::types::U256, voting_period: ::ethers::core::types::U256, quorum_numerator: ::ethers::core::types::U256, proposal_threshold: ::ethers::core::types::U256, min_period_after_quorum: u64) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash(
                    [91, 68, 122, 87],
                    (
                        token,
                        timelock,
                        owner,
                        voting_delay,
                        voting_period,
                        quorum_numerator,
                        proposal_threshold,
                        min_period_after_quorum,
                    ),
                )
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `lateQuorumVoteExtension` (0x32b8113e) function
        pub fn late_quorum_vote_extension(&self) -> ::ethers::contract::builders::ContractCall<M, u64> {
            self.0
                .method_hash([50, 184, 17, 62], ())
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `name` (0x06fdde03) function
        pub fn name(&self) -> ::ethers::contract::builders::ContractCall<M, ::std::string::String> {
            self.0
                .method_hash([6, 253, 222, 3], ())
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
        ///Calls the contract's `proposalEta` (0xab58fb8e) function
        pub fn proposal_eta(&self, proposal_id: ::ethers::core::types::U256) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash([171, 88, 251, 142], proposal_id)
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
        ///Calls the contract's `proposalVotes` (0x544ffc9c) function
        pub fn proposal_votes(
            &self,
            proposal_id: ::ethers::core::types::U256,
        ) -> ::ethers::contract::builders::ContractCall<
            M,
            (
                ::ethers::core::types::U256,
                ::ethers::core::types::U256,
                ::ethers::core::types::U256,
            ),
        > {
            self.0
                .method_hash([84, 79, 252, 156], proposal_id)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `propose` (0x7d5e81e2) function
        pub fn propose(&self, targets: ::std::vec::Vec<::ethers::core::types::Address>, values: ::std::vec::Vec<::ethers::core::types::U256>, calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>, description: ::std::string::String) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash(
                    [125, 94, 129, 226],
                    (targets, values, calldatas, description),
                )
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `queue` (0x160cbed7) function
        pub fn queue(&self, targets: ::std::vec::Vec<::ethers::core::types::Address>, values: ::std::vec::Vec<::ethers::core::types::U256>, calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>, description_hash: [u8; 32]) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::U256> {
            self.0
                .method_hash(
                    [22, 12, 190, 215],
                    (targets, values, calldatas, description_hash),
                )
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
        ///Calls the contract's `setLateQuorumVoteExtension` (0xd07f91e9) function
        pub fn set_late_quorum_vote_extension(&self, new_vote_extension: u64) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([208, 127, 145, 233], new_vote_extension)
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
        ///Calls the contract's `timelock` (0xd33219b4) function
        pub fn timelock(&self) -> ::ethers::contract::builders::ContractCall<M, ::ethers::core::types::Address> {
            self.0
                .method_hash([211, 50, 25, 180], ())
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
        ///Calls the contract's `updateTimelock` (0xa890c910) function
        pub fn update_timelock(&self, new_timelock: ::ethers::core::types::Address) -> ::ethers::contract::builders::ContractCall<M, ()> {
            self.0
                .method_hash([168, 144, 201, 16], new_timelock)
                .expect("method not found (this should never happen)")
        }
        ///Calls the contract's `version` (0x54fd4d50) function
        pub fn version(&self) -> ::ethers::contract::builders::ContractCall<M, ::std::string::String> {
            self.0
                .method_hash([84, 253, 77, 80], ())
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
        ///Gets the contract's `Initialized` event
        pub fn initialized_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, InitializedFilter> {
            self.0.event()
        }
        ///Gets the contract's `LateQuorumVoteExtensionSet` event
        pub fn late_quorum_vote_extension_set_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, LateQuorumVoteExtensionSetFilter> {
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
        ///Gets the contract's `ProposalExtended` event
        pub fn proposal_extended_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, ProposalExtendedFilter> {
            self.0.event()
        }
        ///Gets the contract's `ProposalQueued` event
        pub fn proposal_queued_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, ProposalQueuedFilter> {
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
        ///Gets the contract's `TimelockChange` event
        pub fn timelock_change_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, TimelockChangeFilter> {
            self.0.event()
        }
        ///Gets the contract's `VoteCast` event
        pub fn vote_cast_filter(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, VoteCastFilter> {
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
        pub fn events(&self) -> ::ethers::contract::builders::Event<::std::sync::Arc<M>, M, RindexerArbitrumTreasuryGovernorGenEvents> {
            self.0
                .event_with_filter(::core::default::Default::default())
        }
    }
    impl<M: ::ethers::providers::Middleware> From<::ethers::contract::Contract<M>> for RindexerArbitrumTreasuryGovernorGen<M> {
        fn from(contract: ::ethers::contract::Contract<M>) -> Self {
            Self::new(contract.address(), contract.client())
        }
    }
    ///Custom Error type `Empty` with signature `Empty()` and selector `0x3db2a12a`
    #[derive(Clone, ::ethers::contract::EthError, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[etherror(name = "Empty", abi = "Empty()")]
    pub struct Empty;
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(name = "Initialized", abi = "Initialized(uint8)")]
    pub struct InitializedFilter {
        pub version: u8,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(
        name = "LateQuorumVoteExtensionSet",
        abi = "LateQuorumVoteExtensionSet(uint64,uint64)"
    )]
    pub struct LateQuorumVoteExtensionSetFilter {
        pub old_vote_extension: u64,
        pub new_vote_extension: u64,
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
    #[ethevent(name = "ProposalExtended", abi = "ProposalExtended(uint256,uint64)")]
    pub struct ProposalExtendedFilter {
        #[ethevent(indexed)]
        pub proposal_id: ::ethers::core::types::U256,
        pub extended_deadline: u64,
    }
    #[derive(Clone, ::ethers::contract::EthEvent, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethevent(name = "ProposalQueued", abi = "ProposalQueued(uint256,uint256)")]
    pub struct ProposalQueuedFilter {
        pub proposal_id: ::ethers::core::types::U256,
        pub eta: ::ethers::core::types::U256,
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
    #[ethevent(name = "TimelockChange", abi = "TimelockChange(address,address)")]
    pub struct TimelockChangeFilter {
        pub old_timelock: ::ethers::core::types::Address,
        pub new_timelock: ::ethers::core::types::Address,
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
    pub enum RindexerArbitrumTreasuryGovernorGenEvents {
        InitializedFilter(InitializedFilter),
        LateQuorumVoteExtensionSetFilter(LateQuorumVoteExtensionSetFilter),
        OwnershipTransferredFilter(OwnershipTransferredFilter),
        ProposalCanceledFilter(ProposalCanceledFilter),
        ProposalCreatedFilter(ProposalCreatedFilter),
        ProposalExecutedFilter(ProposalExecutedFilter),
        ProposalExtendedFilter(ProposalExtendedFilter),
        ProposalQueuedFilter(ProposalQueuedFilter),
        ProposalThresholdSetFilter(ProposalThresholdSetFilter),
        QuorumNumeratorUpdatedFilter(QuorumNumeratorUpdatedFilter),
        TimelockChangeFilter(TimelockChangeFilter),
        VoteCastFilter(VoteCastFilter),
        VoteCastWithParamsFilter(VoteCastWithParamsFilter),
        VotingDelaySetFilter(VotingDelaySetFilter),
        VotingPeriodSetFilter(VotingPeriodSetFilter),
    }
    impl ::ethers::contract::EthLogDecode for RindexerArbitrumTreasuryGovernorGenEvents {
        fn decode_log(log: &::ethers::core::abi::RawLog) -> ::core::result::Result<Self, ::ethers::core::abi::Error> {
            if let Ok(decoded) = InitializedFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::InitializedFilter(decoded));
            }
            if let Ok(decoded) = LateQuorumVoteExtensionSetFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::LateQuorumVoteExtensionSetFilter(decoded));
            }
            if let Ok(decoded) = OwnershipTransferredFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::OwnershipTransferredFilter(decoded));
            }
            if let Ok(decoded) = ProposalCanceledFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::ProposalCanceledFilter(decoded));
            }
            if let Ok(decoded) = ProposalCreatedFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::ProposalCreatedFilter(decoded));
            }
            if let Ok(decoded) = ProposalExecutedFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::ProposalExecutedFilter(decoded));
            }
            if let Ok(decoded) = ProposalExtendedFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::ProposalExtendedFilter(decoded));
            }
            if let Ok(decoded) = ProposalQueuedFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::ProposalQueuedFilter(decoded));
            }
            if let Ok(decoded) = ProposalThresholdSetFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::ProposalThresholdSetFilter(decoded));
            }
            if let Ok(decoded) = QuorumNumeratorUpdatedFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::QuorumNumeratorUpdatedFilter(decoded));
            }
            if let Ok(decoded) = TimelockChangeFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::TimelockChangeFilter(decoded));
            }
            if let Ok(decoded) = VoteCastFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::VoteCastFilter(
                    decoded,
                ));
            }
            if let Ok(decoded) = VoteCastWithParamsFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::VoteCastWithParamsFilter(decoded));
            }
            if let Ok(decoded) = VotingDelaySetFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::VotingDelaySetFilter(decoded));
            }
            if let Ok(decoded) = VotingPeriodSetFilter::decode_log(log) {
                return Ok(RindexerArbitrumTreasuryGovernorGenEvents::VotingPeriodSetFilter(decoded));
            }
            Err(::ethers::core::abi::Error::InvalidData)
        }
    }
    impl ::core::fmt::Display for RindexerArbitrumTreasuryGovernorGenEvents {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
            match self {
                Self::InitializedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::LateQuorumVoteExtensionSetFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::OwnershipTransferredFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalCanceledFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalCreatedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalExecutedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalExtendedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalQueuedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalThresholdSetFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::QuorumNumeratorUpdatedFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::TimelockChangeFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::VoteCastFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::VoteCastWithParamsFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::VotingDelaySetFilter(element) => ::core::fmt::Display::fmt(element, f),
                Self::VotingPeriodSetFilter(element) => ::core::fmt::Display::fmt(element, f),
            }
        }
    }
    impl ::core::convert::From<InitializedFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: InitializedFilter) -> Self {
            Self::InitializedFilter(value)
        }
    }
    impl ::core::convert::From<LateQuorumVoteExtensionSetFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: LateQuorumVoteExtensionSetFilter) -> Self {
            Self::LateQuorumVoteExtensionSetFilter(value)
        }
    }
    impl ::core::convert::From<OwnershipTransferredFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: OwnershipTransferredFilter) -> Self {
            Self::OwnershipTransferredFilter(value)
        }
    }
    impl ::core::convert::From<ProposalCanceledFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: ProposalCanceledFilter) -> Self {
            Self::ProposalCanceledFilter(value)
        }
    }
    impl ::core::convert::From<ProposalCreatedFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: ProposalCreatedFilter) -> Self {
            Self::ProposalCreatedFilter(value)
        }
    }
    impl ::core::convert::From<ProposalExecutedFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: ProposalExecutedFilter) -> Self {
            Self::ProposalExecutedFilter(value)
        }
    }
    impl ::core::convert::From<ProposalExtendedFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: ProposalExtendedFilter) -> Self {
            Self::ProposalExtendedFilter(value)
        }
    }
    impl ::core::convert::From<ProposalQueuedFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: ProposalQueuedFilter) -> Self {
            Self::ProposalQueuedFilter(value)
        }
    }
    impl ::core::convert::From<ProposalThresholdSetFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: ProposalThresholdSetFilter) -> Self {
            Self::ProposalThresholdSetFilter(value)
        }
    }
    impl ::core::convert::From<QuorumNumeratorUpdatedFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: QuorumNumeratorUpdatedFilter) -> Self {
            Self::QuorumNumeratorUpdatedFilter(value)
        }
    }
    impl ::core::convert::From<TimelockChangeFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: TimelockChangeFilter) -> Self {
            Self::TimelockChangeFilter(value)
        }
    }
    impl ::core::convert::From<VoteCastFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: VoteCastFilter) -> Self {
            Self::VoteCastFilter(value)
        }
    }
    impl ::core::convert::From<VoteCastWithParamsFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: VoteCastWithParamsFilter) -> Self {
            Self::VoteCastWithParamsFilter(value)
        }
    }
    impl ::core::convert::From<VotingDelaySetFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: VotingDelaySetFilter) -> Self {
            Self::VotingDelaySetFilter(value)
        }
    }
    impl ::core::convert::From<VotingPeriodSetFilter> for RindexerArbitrumTreasuryGovernorGenEvents {
        fn from(value: VotingPeriodSetFilter) -> Self {
            Self::VotingPeriodSetFilter(value)
        }
    }
    ///Container type for all input parameters for the `BALLOT_TYPEHASH` function with signature
    /// `BALLOT_TYPEHASH()` and selector `0xdeaaa7cc`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "BALLOT_TYPEHASH", abi = "BALLOT_TYPEHASH()")]
    pub struct BallotTypehashCall;
    ///Container type for all input parameters for the `COUNTING_MODE` function with signature
    /// `COUNTING_MODE()` and selector `0xdd4e2ba5`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "COUNTING_MODE", abi = "COUNTING_MODE()")]
    pub struct CountingModeCall;
    ///Container type for all input parameters for the `EXCLUDE_ADDRESS` function with signature
    /// `EXCLUDE_ADDRESS()` and selector `0x5e12ebbd`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "EXCLUDE_ADDRESS", abi = "EXCLUDE_ADDRESS()")]
    pub struct ExcludeAddressCall;
    ///Container type for all input parameters for the `EXTENDED_BALLOT_TYPEHASH` function with
    /// signature `EXTENDED_BALLOT_TYPEHASH()` and selector `0x2fe3e261`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "EXTENDED_BALLOT_TYPEHASH", abi = "EXTENDED_BALLOT_TYPEHASH()")]
    pub struct ExtendedBallotTypehashCall;
    ///Container type for all input parameters for the `castVote` function with signature
    /// `castVote(uint256,uint8)` and selector `0x56781388`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "castVote", abi = "castVote(uint256,uint8)")]
    pub struct CastVoteCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub support: u8,
    }
    ///Container type for all input parameters for the `castVoteBySig` function with signature
    /// `castVoteBySig(uint256,uint8,uint8,bytes32,bytes32)` and selector `0x3bccf4fd`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "castVoteBySig",
        abi = "castVoteBySig(uint256,uint8,uint8,bytes32,bytes32)"
    )]
    pub struct CastVoteBySigCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub support: u8,
        pub v: u8,
        pub r: [u8; 32],
        pub s: [u8; 32],
    }
    ///Container type for all input parameters for the `castVoteWithReason` function with signature
    /// `castVoteWithReason(uint256,uint8,string)` and selector `0x7b3c71d3`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "castVoteWithReason",
        abi = "castVoteWithReason(uint256,uint8,string)"
    )]
    pub struct CastVoteWithReasonCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub support: u8,
        pub reason: ::std::string::String,
    }
    ///Container type for all input parameters for the `castVoteWithReasonAndParams` function with
    /// signature `castVoteWithReasonAndParams(uint256,uint8,string,bytes)` and selector
    /// `0x5f398a14`
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
    ///Container type for all input parameters for the `castVoteWithReasonAndParamsBySig` function
    /// with signature
    /// `castVoteWithReasonAndParamsBySig(uint256,uint8,string,bytes,uint8,bytes32,bytes32)` and
    /// selector `0x03420181`
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
    ///Container type for all input parameters for the `execute` function with signature
    /// `execute(address[],uint256[],bytes[],bytes32)` and selector `0x2656227d`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "execute", abi = "execute(address[],uint256[],bytes[],bytes32)")]
    pub struct ExecuteCall {
        pub targets: ::std::vec::Vec<::ethers::core::types::Address>,
        pub values: ::std::vec::Vec<::ethers::core::types::U256>,
        pub calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>,
        pub description_hash: [u8; 32],
    }
    ///Container type for all input parameters for the `getPastCirculatingSupply` function with
    /// signature `getPastCirculatingSupply(uint256)` and selector `0x6e462680`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "getPastCirculatingSupply",
        abi = "getPastCirculatingSupply(uint256)"
    )]
    pub struct GetPastCirculatingSupplyCall {
        pub block_number: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `getVotes` function with signature
    /// `getVotes(address,uint256)` and selector `0xeb9019d4`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "getVotes", abi = "getVotes(address,uint256)")]
    pub struct GetVotesCall {
        pub account: ::ethers::core::types::Address,
        pub block_number: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `getVotesWithParams` function with signature
    /// `getVotesWithParams(address,uint256,bytes)` and selector `0x9a802a6d`
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
    ///Container type for all input parameters for the `hasVoted` function with signature
    /// `hasVoted(uint256,address)` and selector `0x43859632`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "hasVoted", abi = "hasVoted(uint256,address)")]
    pub struct HasVotedCall {
        pub proposal_id: ::ethers::core::types::U256,
        pub account: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `hashProposal` function with signature
    /// `hashProposal(address[],uint256[],bytes[],bytes32)` and selector `0xc59057e4`
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
    ///Container type for all input parameters for the `initialize` function with signature
    /// `initialize(address,address,address,uint256,uint256,uint256,uint256,uint64)` and selector
    /// `0x5b447a57`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "initialize",
        abi = "initialize(address,address,address,uint256,uint256,uint256,uint256,uint64)"
    )]
    pub struct InitializeCall {
        pub token: ::ethers::core::types::Address,
        pub timelock: ::ethers::core::types::Address,
        pub owner: ::ethers::core::types::Address,
        pub voting_delay: ::ethers::core::types::U256,
        pub voting_period: ::ethers::core::types::U256,
        pub quorum_numerator: ::ethers::core::types::U256,
        pub proposal_threshold: ::ethers::core::types::U256,
        pub min_period_after_quorum: u64,
    }
    ///Container type for all input parameters for the `lateQuorumVoteExtension` function with
    /// signature `lateQuorumVoteExtension()` and selector `0x32b8113e`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "lateQuorumVoteExtension", abi = "lateQuorumVoteExtension()")]
    pub struct LateQuorumVoteExtensionCall;
    ///Container type for all input parameters for the `name` function with signature `name()` and
    /// selector `0x06fdde03`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "name", abi = "name()")]
    pub struct NameCall;
    ///Container type for all input parameters for the `onERC1155BatchReceived` function with
    /// signature `onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)` and selector
    /// `0xbc197c81`
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
    ///Container type for all input parameters for the `onERC1155Received` function with signature
    /// `onERC1155Received(address,address,uint256,uint256,bytes)` and selector `0xf23a6e61`
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
    ///Container type for all input parameters for the `onERC721Received` function with signature
    /// `onERC721Received(address,address,uint256,bytes)` and selector `0x150b7a02`
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
    ///Container type for all input parameters for the `owner` function with signature `owner()`
    /// and selector `0x8da5cb5b`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "owner", abi = "owner()")]
    pub struct OwnerCall;
    ///Container type for all input parameters for the `proposalDeadline` function with signature
    /// `proposalDeadline(uint256)` and selector `0xc01f9e37`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "proposalDeadline", abi = "proposalDeadline(uint256)")]
    pub struct ProposalDeadlineCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `proposalEta` function with signature
    /// `proposalEta(uint256)` and selector `0xab58fb8e`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "proposalEta", abi = "proposalEta(uint256)")]
    pub struct ProposalEtaCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `proposalSnapshot` function with signature
    /// `proposalSnapshot(uint256)` and selector `0x2d63f693`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "proposalSnapshot", abi = "proposalSnapshot(uint256)")]
    pub struct ProposalSnapshotCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `proposalThreshold` function with signature
    /// `proposalThreshold()` and selector `0xb58131b0`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "proposalThreshold", abi = "proposalThreshold()")]
    pub struct ProposalThresholdCall;
    ///Container type for all input parameters for the `proposalVotes` function with signature
    /// `proposalVotes(uint256)` and selector `0x544ffc9c`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "proposalVotes", abi = "proposalVotes(uint256)")]
    pub struct ProposalVotesCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `propose` function with signature
    /// `propose(address[],uint256[],bytes[],string)` and selector `0x7d5e81e2`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "propose", abi = "propose(address[],uint256[],bytes[],string)")]
    pub struct ProposeCall {
        pub targets: ::std::vec::Vec<::ethers::core::types::Address>,
        pub values: ::std::vec::Vec<::ethers::core::types::U256>,
        pub calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>,
        pub description: ::std::string::String,
    }
    ///Container type for all input parameters for the `queue` function with signature
    /// `queue(address[],uint256[],bytes[],bytes32)` and selector `0x160cbed7`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "queue", abi = "queue(address[],uint256[],bytes[],bytes32)")]
    pub struct QueueCall {
        pub targets: ::std::vec::Vec<::ethers::core::types::Address>,
        pub values: ::std::vec::Vec<::ethers::core::types::U256>,
        pub calldatas: ::std::vec::Vec<::ethers::core::types::Bytes>,
        pub description_hash: [u8; 32],
    }
    ///Container type for all input parameters for the `quorum` function with signature
    /// `quorum(uint256)` and selector `0xf8ce560a`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "quorum", abi = "quorum(uint256)")]
    pub struct QuorumCall {
        pub block_number: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `quorumDenominator` function with signature
    /// `quorumDenominator()` and selector `0x97c3d334`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "quorumDenominator", abi = "quorumDenominator()")]
    pub struct QuorumDenominatorCall;
    ///Container type for all input parameters for the `quorumNumerator` function with signature
    /// `quorumNumerator(uint256)` and selector `0x60c4247f`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "quorumNumerator", abi = "quorumNumerator(uint256)")]
    pub struct QuorumNumeratorWithBlockNumberCall {
        pub block_number: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `quorumNumerator` function with signature
    /// `quorumNumerator()` and selector `0xa7713a70`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "quorumNumerator", abi = "quorumNumerator()")]
    pub struct QuorumNumeratorCall;
    ///Container type for all input parameters for the `relay` function with signature
    /// `relay(address,uint256,bytes)` and selector `0xc28bc2fa`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "relay", abi = "relay(address,uint256,bytes)")]
    pub struct RelayCall {
        pub target: ::ethers::core::types::Address,
        pub value: ::ethers::core::types::U256,
        pub data: ::ethers::core::types::Bytes,
    }
    ///Container type for all input parameters for the `renounceOwnership` function with signature
    /// `renounceOwnership()` and selector `0x715018a6`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "renounceOwnership", abi = "renounceOwnership()")]
    pub struct RenounceOwnershipCall;
    ///Container type for all input parameters for the `setLateQuorumVoteExtension` function with
    /// signature `setLateQuorumVoteExtension(uint64)` and selector `0xd07f91e9`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(
        name = "setLateQuorumVoteExtension",
        abi = "setLateQuorumVoteExtension(uint64)"
    )]
    pub struct SetLateQuorumVoteExtensionCall {
        pub new_vote_extension: u64,
    }
    ///Container type for all input parameters for the `setProposalThreshold` function with
    /// signature `setProposalThreshold(uint256)` and selector `0xece40cc1`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "setProposalThreshold", abi = "setProposalThreshold(uint256)")]
    pub struct SetProposalThresholdCall {
        pub new_proposal_threshold: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `setVotingDelay` function with signature
    /// `setVotingDelay(uint256)` and selector `0x70b0f660`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "setVotingDelay", abi = "setVotingDelay(uint256)")]
    pub struct SetVotingDelayCall {
        pub new_voting_delay: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `setVotingPeriod` function with signature
    /// `setVotingPeriod(uint256)` and selector `0xea0217cf`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "setVotingPeriod", abi = "setVotingPeriod(uint256)")]
    pub struct SetVotingPeriodCall {
        pub new_voting_period: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `state` function with signature
    /// `state(uint256)` and selector `0x3e4f49e6`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "state", abi = "state(uint256)")]
    pub struct StateCall {
        pub proposal_id: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `supportsInterface` function with signature
    /// `supportsInterface(bytes4)` and selector `0x01ffc9a7`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "supportsInterface", abi = "supportsInterface(bytes4)")]
    pub struct SupportsInterfaceCall {
        pub interface_id: [u8; 4],
    }
    ///Container type for all input parameters for the `timelock` function with signature
    /// `timelock()` and selector `0xd33219b4`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "timelock", abi = "timelock()")]
    pub struct TimelockCall;
    ///Container type for all input parameters for the `token` function with signature `token()`
    /// and selector `0xfc0c546a`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "token", abi = "token()")]
    pub struct TokenCall;
    ///Container type for all input parameters for the `transferOwnership` function with signature
    /// `transferOwnership(address)` and selector `0xf2fde38b`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "transferOwnership", abi = "transferOwnership(address)")]
    pub struct TransferOwnershipCall {
        pub new_owner: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `updateQuorumNumerator` function with
    /// signature `updateQuorumNumerator(uint256)` and selector `0x06f3f9e6`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "updateQuorumNumerator", abi = "updateQuorumNumerator(uint256)")]
    pub struct UpdateQuorumNumeratorCall {
        pub new_quorum_numerator: ::ethers::core::types::U256,
    }
    ///Container type for all input parameters for the `updateTimelock` function with signature
    /// `updateTimelock(address)` and selector `0xa890c910`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "updateTimelock", abi = "updateTimelock(address)")]
    pub struct UpdateTimelockCall {
        pub new_timelock: ::ethers::core::types::Address,
    }
    ///Container type for all input parameters for the `version` function with signature
    /// `version()` and selector `0x54fd4d50`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "version", abi = "version()")]
    pub struct VersionCall;
    ///Container type for all input parameters for the `votingDelay` function with signature
    /// `votingDelay()` and selector `0x3932abb1`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "votingDelay", abi = "votingDelay()")]
    pub struct VotingDelayCall;
    ///Container type for all input parameters for the `votingPeriod` function with signature
    /// `votingPeriod()` and selector `0x02a251a3`
    #[derive(Clone, ::ethers::contract::EthCall, ::ethers::contract::EthDisplay, Default, Debug, PartialEq, Eq, Hash)]
    #[ethcall(name = "votingPeriod", abi = "votingPeriod()")]
    pub struct VotingPeriodCall;
    ///Container type for all of the contract's call
    #[derive(Clone, ::ethers::contract::EthAbiType, Debug, PartialEq, Eq, Hash)]
    pub enum RindexerArbitrumTreasuryGovernorGenCalls {
        BallotTypehash(BallotTypehashCall),
        CountingMode(CountingModeCall),
        ExcludeAddress(ExcludeAddressCall),
        ExtendedBallotTypehash(ExtendedBallotTypehashCall),
        CastVote(CastVoteCall),
        CastVoteBySig(CastVoteBySigCall),
        CastVoteWithReason(CastVoteWithReasonCall),
        CastVoteWithReasonAndParams(CastVoteWithReasonAndParamsCall),
        CastVoteWithReasonAndParamsBySig(CastVoteWithReasonAndParamsBySigCall),
        Execute(ExecuteCall),
        GetPastCirculatingSupply(GetPastCirculatingSupplyCall),
        GetVotes(GetVotesCall),
        GetVotesWithParams(GetVotesWithParamsCall),
        HasVoted(HasVotedCall),
        HashProposal(HashProposalCall),
        Initialize(InitializeCall),
        LateQuorumVoteExtension(LateQuorumVoteExtensionCall),
        Name(NameCall),
        OnERC1155BatchReceived(OnERC1155BatchReceivedCall),
        OnERC1155Received(OnERC1155ReceivedCall),
        OnERC721Received(OnERC721ReceivedCall),
        Owner(OwnerCall),
        ProposalDeadline(ProposalDeadlineCall),
        ProposalEta(ProposalEtaCall),
        ProposalSnapshot(ProposalSnapshotCall),
        ProposalThreshold(ProposalThresholdCall),
        ProposalVotes(ProposalVotesCall),
        Propose(ProposeCall),
        Queue(QueueCall),
        Quorum(QuorumCall),
        QuorumDenominator(QuorumDenominatorCall),
        QuorumNumeratorWithBlockNumber(QuorumNumeratorWithBlockNumberCall),
        QuorumNumerator(QuorumNumeratorCall),
        Relay(RelayCall),
        RenounceOwnership(RenounceOwnershipCall),
        SetLateQuorumVoteExtension(SetLateQuorumVoteExtensionCall),
        SetProposalThreshold(SetProposalThresholdCall),
        SetVotingDelay(SetVotingDelayCall),
        SetVotingPeriod(SetVotingPeriodCall),
        State(StateCall),
        SupportsInterface(SupportsInterfaceCall),
        Timelock(TimelockCall),
        Token(TokenCall),
        TransferOwnership(TransferOwnershipCall),
        UpdateQuorumNumerator(UpdateQuorumNumeratorCall),
        UpdateTimelock(UpdateTimelockCall),
        Version(VersionCall),
        VotingDelay(VotingDelayCall),
        VotingPeriod(VotingPeriodCall),
    }
    impl ::ethers::core::abi::AbiDecode for RindexerArbitrumTreasuryGovernorGenCalls {
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
            if let Ok(decoded) = <ExecuteCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Execute(decoded));
            }
            if let Ok(decoded) = <GetPastCirculatingSupplyCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::GetPastCirculatingSupply(decoded));
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
            if let Ok(decoded) = <InitializeCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Initialize(decoded));
            }
            if let Ok(decoded) = <LateQuorumVoteExtensionCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::LateQuorumVoteExtension(decoded));
            }
            if let Ok(decoded) = <NameCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Name(decoded));
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
            if let Ok(decoded) = <OwnerCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Owner(decoded));
            }
            if let Ok(decoded) = <ProposalDeadlineCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalDeadline(decoded));
            }
            if let Ok(decoded) = <ProposalEtaCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalEta(decoded));
            }
            if let Ok(decoded) = <ProposalSnapshotCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalSnapshot(decoded));
            }
            if let Ok(decoded) = <ProposalThresholdCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalThreshold(decoded));
            }
            if let Ok(decoded) = <ProposalVotesCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::ProposalVotes(decoded));
            }
            if let Ok(decoded) = <ProposeCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Propose(decoded));
            }
            if let Ok(decoded) = <QueueCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Queue(decoded));
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
            if let Ok(decoded) = <RelayCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Relay(decoded));
            }
            if let Ok(decoded) = <RenounceOwnershipCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::RenounceOwnership(decoded));
            }
            if let Ok(decoded) = <SetLateQuorumVoteExtensionCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::SetLateQuorumVoteExtension(decoded));
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
            if let Ok(decoded) = <TimelockCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Timelock(decoded));
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
            if let Ok(decoded) = <UpdateTimelockCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::UpdateTimelock(decoded));
            }
            if let Ok(decoded) = <VersionCall as ::ethers::core::abi::AbiDecode>::decode(data) {
                return Ok(Self::Version(decoded));
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
    impl ::ethers::core::abi::AbiEncode for RindexerArbitrumTreasuryGovernorGenCalls {
        fn encode(self) -> Vec<u8> {
            match self {
                Self::BallotTypehash(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CountingMode(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ExcludeAddress(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ExtendedBallotTypehash(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVote(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVoteBySig(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVoteWithReason(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVoteWithReasonAndParams(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::CastVoteWithReasonAndParamsBySig(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Execute(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::GetPastCirculatingSupply(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::GetVotes(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::GetVotesWithParams(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::HasVoted(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::HashProposal(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Initialize(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::LateQuorumVoteExtension(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Name(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::OnERC1155BatchReceived(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::OnERC1155Received(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::OnERC721Received(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Owner(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalDeadline(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalEta(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalSnapshot(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalThreshold(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::ProposalVotes(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Propose(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Queue(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Quorum(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::QuorumDenominator(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::QuorumNumeratorWithBlockNumber(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::QuorumNumerator(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Relay(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::RenounceOwnership(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SetLateQuorumVoteExtension(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SetProposalThreshold(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SetVotingDelay(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SetVotingPeriod(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::State(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::SupportsInterface(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Timelock(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Token(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::TransferOwnership(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::UpdateQuorumNumerator(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::UpdateTimelock(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::Version(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::VotingDelay(element) => ::ethers::core::abi::AbiEncode::encode(element),
                Self::VotingPeriod(element) => ::ethers::core::abi::AbiEncode::encode(element),
            }
        }
    }
    impl ::core::fmt::Display for RindexerArbitrumTreasuryGovernorGenCalls {
        fn fmt(&self, f: &mut ::core::fmt::Formatter<'_>) -> ::core::fmt::Result {
            match self {
                Self::BallotTypehash(element) => ::core::fmt::Display::fmt(element, f),
                Self::CountingMode(element) => ::core::fmt::Display::fmt(element, f),
                Self::ExcludeAddress(element) => ::core::fmt::Display::fmt(element, f),
                Self::ExtendedBallotTypehash(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVote(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVoteBySig(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVoteWithReason(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVoteWithReasonAndParams(element) => ::core::fmt::Display::fmt(element, f),
                Self::CastVoteWithReasonAndParamsBySig(element) => ::core::fmt::Display::fmt(element, f),
                Self::Execute(element) => ::core::fmt::Display::fmt(element, f),
                Self::GetPastCirculatingSupply(element) => ::core::fmt::Display::fmt(element, f),
                Self::GetVotes(element) => ::core::fmt::Display::fmt(element, f),
                Self::GetVotesWithParams(element) => ::core::fmt::Display::fmt(element, f),
                Self::HasVoted(element) => ::core::fmt::Display::fmt(element, f),
                Self::HashProposal(element) => ::core::fmt::Display::fmt(element, f),
                Self::Initialize(element) => ::core::fmt::Display::fmt(element, f),
                Self::LateQuorumVoteExtension(element) => ::core::fmt::Display::fmt(element, f),
                Self::Name(element) => ::core::fmt::Display::fmt(element, f),
                Self::OnERC1155BatchReceived(element) => ::core::fmt::Display::fmt(element, f),
                Self::OnERC1155Received(element) => ::core::fmt::Display::fmt(element, f),
                Self::OnERC721Received(element) => ::core::fmt::Display::fmt(element, f),
                Self::Owner(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalDeadline(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalEta(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalSnapshot(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalThreshold(element) => ::core::fmt::Display::fmt(element, f),
                Self::ProposalVotes(element) => ::core::fmt::Display::fmt(element, f),
                Self::Propose(element) => ::core::fmt::Display::fmt(element, f),
                Self::Queue(element) => ::core::fmt::Display::fmt(element, f),
                Self::Quorum(element) => ::core::fmt::Display::fmt(element, f),
                Self::QuorumDenominator(element) => ::core::fmt::Display::fmt(element, f),
                Self::QuorumNumeratorWithBlockNumber(element) => ::core::fmt::Display::fmt(element, f),
                Self::QuorumNumerator(element) => ::core::fmt::Display::fmt(element, f),
                Self::Relay(element) => ::core::fmt::Display::fmt(element, f),
                Self::RenounceOwnership(element) => ::core::fmt::Display::fmt(element, f),
                Self::SetLateQuorumVoteExtension(element) => ::core::fmt::Display::fmt(element, f),
                Self::SetProposalThreshold(element) => ::core::fmt::Display::fmt(element, f),
                Self::SetVotingDelay(element) => ::core::fmt::Display::fmt(element, f),
                Self::SetVotingPeriod(element) => ::core::fmt::Display::fmt(element, f),
                Self::State(element) => ::core::fmt::Display::fmt(element, f),
                Self::SupportsInterface(element) => ::core::fmt::Display::fmt(element, f),
                Self::Timelock(element) => ::core::fmt::Display::fmt(element, f),
                Self::Token(element) => ::core::fmt::Display::fmt(element, f),
                Self::TransferOwnership(element) => ::core::fmt::Display::fmt(element, f),
                Self::UpdateQuorumNumerator(element) => ::core::fmt::Display::fmt(element, f),
                Self::UpdateTimelock(element) => ::core::fmt::Display::fmt(element, f),
                Self::Version(element) => ::core::fmt::Display::fmt(element, f),
                Self::VotingDelay(element) => ::core::fmt::Display::fmt(element, f),
                Self::VotingPeriod(element) => ::core::fmt::Display::fmt(element, f),
            }
        }
    }
    impl ::core::convert::From<BallotTypehashCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: BallotTypehashCall) -> Self {
            Self::BallotTypehash(value)
        }
    }
    impl ::core::convert::From<CountingModeCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: CountingModeCall) -> Self {
            Self::CountingMode(value)
        }
    }
    impl ::core::convert::From<ExcludeAddressCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: ExcludeAddressCall) -> Self {
            Self::ExcludeAddress(value)
        }
    }
    impl ::core::convert::From<ExtendedBallotTypehashCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: ExtendedBallotTypehashCall) -> Self {
            Self::ExtendedBallotTypehash(value)
        }
    }
    impl ::core::convert::From<CastVoteCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: CastVoteCall) -> Self {
            Self::CastVote(value)
        }
    }
    impl ::core::convert::From<CastVoteBySigCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: CastVoteBySigCall) -> Self {
            Self::CastVoteBySig(value)
        }
    }
    impl ::core::convert::From<CastVoteWithReasonCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: CastVoteWithReasonCall) -> Self {
            Self::CastVoteWithReason(value)
        }
    }
    impl ::core::convert::From<CastVoteWithReasonAndParamsCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: CastVoteWithReasonAndParamsCall) -> Self {
            Self::CastVoteWithReasonAndParams(value)
        }
    }
    impl ::core::convert::From<CastVoteWithReasonAndParamsBySigCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: CastVoteWithReasonAndParamsBySigCall) -> Self {
            Self::CastVoteWithReasonAndParamsBySig(value)
        }
    }
    impl ::core::convert::From<ExecuteCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: ExecuteCall) -> Self {
            Self::Execute(value)
        }
    }
    impl ::core::convert::From<GetPastCirculatingSupplyCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: GetPastCirculatingSupplyCall) -> Self {
            Self::GetPastCirculatingSupply(value)
        }
    }
    impl ::core::convert::From<GetVotesCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: GetVotesCall) -> Self {
            Self::GetVotes(value)
        }
    }
    impl ::core::convert::From<GetVotesWithParamsCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: GetVotesWithParamsCall) -> Self {
            Self::GetVotesWithParams(value)
        }
    }
    impl ::core::convert::From<HasVotedCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: HasVotedCall) -> Self {
            Self::HasVoted(value)
        }
    }
    impl ::core::convert::From<HashProposalCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: HashProposalCall) -> Self {
            Self::HashProposal(value)
        }
    }
    impl ::core::convert::From<InitializeCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: InitializeCall) -> Self {
            Self::Initialize(value)
        }
    }
    impl ::core::convert::From<LateQuorumVoteExtensionCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: LateQuorumVoteExtensionCall) -> Self {
            Self::LateQuorumVoteExtension(value)
        }
    }
    impl ::core::convert::From<NameCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: NameCall) -> Self {
            Self::Name(value)
        }
    }
    impl ::core::convert::From<OnERC1155BatchReceivedCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: OnERC1155BatchReceivedCall) -> Self {
            Self::OnERC1155BatchReceived(value)
        }
    }
    impl ::core::convert::From<OnERC1155ReceivedCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: OnERC1155ReceivedCall) -> Self {
            Self::OnERC1155Received(value)
        }
    }
    impl ::core::convert::From<OnERC721ReceivedCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: OnERC721ReceivedCall) -> Self {
            Self::OnERC721Received(value)
        }
    }
    impl ::core::convert::From<OwnerCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: OwnerCall) -> Self {
            Self::Owner(value)
        }
    }
    impl ::core::convert::From<ProposalDeadlineCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: ProposalDeadlineCall) -> Self {
            Self::ProposalDeadline(value)
        }
    }
    impl ::core::convert::From<ProposalEtaCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: ProposalEtaCall) -> Self {
            Self::ProposalEta(value)
        }
    }
    impl ::core::convert::From<ProposalSnapshotCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: ProposalSnapshotCall) -> Self {
            Self::ProposalSnapshot(value)
        }
    }
    impl ::core::convert::From<ProposalThresholdCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: ProposalThresholdCall) -> Self {
            Self::ProposalThreshold(value)
        }
    }
    impl ::core::convert::From<ProposalVotesCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: ProposalVotesCall) -> Self {
            Self::ProposalVotes(value)
        }
    }
    impl ::core::convert::From<ProposeCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: ProposeCall) -> Self {
            Self::Propose(value)
        }
    }
    impl ::core::convert::From<QueueCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: QueueCall) -> Self {
            Self::Queue(value)
        }
    }
    impl ::core::convert::From<QuorumCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: QuorumCall) -> Self {
            Self::Quorum(value)
        }
    }
    impl ::core::convert::From<QuorumDenominatorCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: QuorumDenominatorCall) -> Self {
            Self::QuorumDenominator(value)
        }
    }
    impl ::core::convert::From<QuorumNumeratorWithBlockNumberCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: QuorumNumeratorWithBlockNumberCall) -> Self {
            Self::QuorumNumeratorWithBlockNumber(value)
        }
    }
    impl ::core::convert::From<QuorumNumeratorCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: QuorumNumeratorCall) -> Self {
            Self::QuorumNumerator(value)
        }
    }
    impl ::core::convert::From<RelayCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: RelayCall) -> Self {
            Self::Relay(value)
        }
    }
    impl ::core::convert::From<RenounceOwnershipCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: RenounceOwnershipCall) -> Self {
            Self::RenounceOwnership(value)
        }
    }
    impl ::core::convert::From<SetLateQuorumVoteExtensionCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: SetLateQuorumVoteExtensionCall) -> Self {
            Self::SetLateQuorumVoteExtension(value)
        }
    }
    impl ::core::convert::From<SetProposalThresholdCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: SetProposalThresholdCall) -> Self {
            Self::SetProposalThreshold(value)
        }
    }
    impl ::core::convert::From<SetVotingDelayCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: SetVotingDelayCall) -> Self {
            Self::SetVotingDelay(value)
        }
    }
    impl ::core::convert::From<SetVotingPeriodCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: SetVotingPeriodCall) -> Self {
            Self::SetVotingPeriod(value)
        }
    }
    impl ::core::convert::From<StateCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: StateCall) -> Self {
            Self::State(value)
        }
    }
    impl ::core::convert::From<SupportsInterfaceCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: SupportsInterfaceCall) -> Self {
            Self::SupportsInterface(value)
        }
    }
    impl ::core::convert::From<TimelockCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: TimelockCall) -> Self {
            Self::Timelock(value)
        }
    }
    impl ::core::convert::From<TokenCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: TokenCall) -> Self {
            Self::Token(value)
        }
    }
    impl ::core::convert::From<TransferOwnershipCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: TransferOwnershipCall) -> Self {
            Self::TransferOwnership(value)
        }
    }
    impl ::core::convert::From<UpdateQuorumNumeratorCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: UpdateQuorumNumeratorCall) -> Self {
            Self::UpdateQuorumNumerator(value)
        }
    }
    impl ::core::convert::From<UpdateTimelockCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: UpdateTimelockCall) -> Self {
            Self::UpdateTimelock(value)
        }
    }
    impl ::core::convert::From<VersionCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: VersionCall) -> Self {
            Self::Version(value)
        }
    }
    impl ::core::convert::From<VotingDelayCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: VotingDelayCall) -> Self {
            Self::VotingDelay(value)
        }
    }
    impl ::core::convert::From<VotingPeriodCall> for RindexerArbitrumTreasuryGovernorGenCalls {
        fn from(value: VotingPeriodCall) -> Self {
            Self::VotingPeriod(value)
        }
    }
    ///Container type for all return fields from the `BALLOT_TYPEHASH` function with signature
    /// `BALLOT_TYPEHASH()` and selector `0xdeaaa7cc`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct BallotTypehashReturn(pub [u8; 32]);
    ///Container type for all return fields from the `COUNTING_MODE` function with signature
    /// `COUNTING_MODE()` and selector `0xdd4e2ba5`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CountingModeReturn(pub ::std::string::String);
    ///Container type for all return fields from the `EXCLUDE_ADDRESS` function with signature
    /// `EXCLUDE_ADDRESS()` and selector `0x5e12ebbd`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ExcludeAddressReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `EXTENDED_BALLOT_TYPEHASH` function with
    /// signature `EXTENDED_BALLOT_TYPEHASH()` and selector `0x2fe3e261`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ExtendedBallotTypehashReturn(pub [u8; 32]);
    ///Container type for all return fields from the `castVote` function with signature
    /// `castVote(uint256,uint8)` and selector `0x56781388`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CastVoteReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `castVoteBySig` function with signature
    /// `castVoteBySig(uint256,uint8,uint8,bytes32,bytes32)` and selector `0x3bccf4fd`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CastVoteBySigReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `castVoteWithReason` function with signature
    /// `castVoteWithReason(uint256,uint8,string)` and selector `0x7b3c71d3`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CastVoteWithReasonReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `castVoteWithReasonAndParams` function with
    /// signature `castVoteWithReasonAndParams(uint256,uint8,string,bytes)` and selector
    /// `0x5f398a14`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CastVoteWithReasonAndParamsReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `castVoteWithReasonAndParamsBySig` function
    /// with signature
    /// `castVoteWithReasonAndParamsBySig(uint256,uint8,string,bytes,uint8,bytes32,bytes32)` and
    /// selector `0x03420181`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct CastVoteWithReasonAndParamsBySigReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `execute` function with signature
    /// `execute(address[],uint256[],bytes[],bytes32)` and selector `0x2656227d`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ExecuteReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `getPastCirculatingSupply` function with
    /// signature `getPastCirculatingSupply(uint256)` and selector `0x6e462680`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct GetPastCirculatingSupplyReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `getVotes` function with signature
    /// `getVotes(address,uint256)` and selector `0xeb9019d4`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct GetVotesReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `getVotesWithParams` function with signature
    /// `getVotesWithParams(address,uint256,bytes)` and selector `0x9a802a6d`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct GetVotesWithParamsReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `hasVoted` function with signature
    /// `hasVoted(uint256,address)` and selector `0x43859632`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct HasVotedReturn(pub bool);
    ///Container type for all return fields from the `hashProposal` function with signature
    /// `hashProposal(address[],uint256[],bytes[],bytes32)` and selector `0xc59057e4`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct HashProposalReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `lateQuorumVoteExtension` function with
    /// signature `lateQuorumVoteExtension()` and selector `0x32b8113e`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct LateQuorumVoteExtensionReturn(pub u64);
    ///Container type for all return fields from the `name` function with signature `name()` and
    /// selector `0x06fdde03`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct NameReturn(pub ::std::string::String);
    ///Container type for all return fields from the `onERC1155BatchReceived` function with
    /// signature `onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)` and selector
    /// `0xbc197c81`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct OnERC1155BatchReceivedReturn(pub [u8; 4]);
    ///Container type for all return fields from the `onERC1155Received` function with signature
    /// `onERC1155Received(address,address,uint256,uint256,bytes)` and selector `0xf23a6e61`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct OnERC1155ReceivedReturn(pub [u8; 4]);
    ///Container type for all return fields from the `onERC721Received` function with signature
    /// `onERC721Received(address,address,uint256,bytes)` and selector `0x150b7a02`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct OnERC721ReceivedReturn(pub [u8; 4]);
    ///Container type for all return fields from the `owner` function with signature `owner()` and
    /// selector `0x8da5cb5b`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct OwnerReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `proposalDeadline` function with signature
    /// `proposalDeadline(uint256)` and selector `0xc01f9e37`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposalDeadlineReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `proposalEta` function with signature
    /// `proposalEta(uint256)` and selector `0xab58fb8e`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposalEtaReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `proposalSnapshot` function with signature
    /// `proposalSnapshot(uint256)` and selector `0x2d63f693`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposalSnapshotReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `proposalThreshold` function with signature
    /// `proposalThreshold()` and selector `0xb58131b0`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposalThresholdReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `proposalVotes` function with signature
    /// `proposalVotes(uint256)` and selector `0x544ffc9c`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposalVotesReturn {
        pub against_votes: ::ethers::core::types::U256,
        pub for_votes: ::ethers::core::types::U256,
        pub abstain_votes: ::ethers::core::types::U256,
    }
    ///Container type for all return fields from the `propose` function with signature
    /// `propose(address[],uint256[],bytes[],string)` and selector `0x7d5e81e2`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct ProposeReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `queue` function with signature
    /// `queue(address[],uint256[],bytes[],bytes32)` and selector `0x160cbed7`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct QueueReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `quorum` function with signature
    /// `quorum(uint256)` and selector `0xf8ce560a`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct QuorumReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `quorumDenominator` function with signature
    /// `quorumDenominator()` and selector `0x97c3d334`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct QuorumDenominatorReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `quorumNumerator` function with signature
    /// `quorumNumerator(uint256)` and selector `0x60c4247f`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct QuorumNumeratorWithBlockNumberReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `quorumNumerator` function with signature
    /// `quorumNumerator()` and selector `0xa7713a70`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct QuorumNumeratorReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `state` function with signature
    /// `state(uint256)` and selector `0x3e4f49e6`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct StateReturn(pub u8);
    ///Container type for all return fields from the `supportsInterface` function with signature
    /// `supportsInterface(bytes4)` and selector `0x01ffc9a7`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct SupportsInterfaceReturn(pub bool);
    ///Container type for all return fields from the `timelock` function with signature
    /// `timelock()` and selector `0xd33219b4`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct TimelockReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `token` function with signature `token()` and
    /// selector `0xfc0c546a`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct TokenReturn(pub ::ethers::core::types::Address);
    ///Container type for all return fields from the `version` function with signature `version()`
    /// and selector `0x54fd4d50`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct VersionReturn(pub ::std::string::String);
    ///Container type for all return fields from the `votingDelay` function with signature
    /// `votingDelay()` and selector `0x3932abb1`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct VotingDelayReturn(pub ::ethers::core::types::U256);
    ///Container type for all return fields from the `votingPeriod` function with signature
    /// `votingPeriod()` and selector `0x02a251a3`
    #[derive(Clone, ::ethers::contract::EthAbiType, ::ethers::contract::EthAbiCodec, Default, Debug, PartialEq, Eq, Hash)]
    pub struct VotingPeriodReturn(pub ::ethers::core::types::U256);
}
