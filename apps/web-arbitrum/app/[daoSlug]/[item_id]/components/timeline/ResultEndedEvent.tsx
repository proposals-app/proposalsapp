import {
  Proposal as DbProposal,
  JsonValue,
  Selectable,
  Vote,
} from "@proposalsapp/db";
import { ApprovalVote } from "./ended_vote_types/ApprovalVote";
import { BasicVote } from "./ended_vote_types/BasicVote";
import { QuadraticVote } from "./ended_vote_types/QuadraticVote";
import { RankedChoiceVote } from "./ended_vote_types/RankedChoiceVote";
import { SingleChoiceVote } from "./ended_vote_types/SingleChoiceVote";
import { WeightedVote } from "./ended_vote_types/WeightedVote";
import React from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface ProposalMetadata {
  voteType?: VoteType;
  [key: string]: unknown;
}

type VoteType =
  | "single-choice"
  | "weighted"
  | "approval"
  | "basic"
  | "quadratic"
  | "ranked-choice";

export interface Proposal extends Omit<Selectable<DbProposal>, "metadata"> {
  metadata: ProposalMetadata | JsonValue;
}

interface ResultEndedEventProps {
  content: string;
  timestamp: Date;
  proposal: Proposal;
  votes: Selectable<Vote>[];
}

const VoteComponents = {
  "single-choice": SingleChoiceVote,
  weighted: WeightedVote,
  approval: ApprovalVote,
  basic: BasicVote,
  quadratic: QuadraticVote,
  "ranked-choice": RankedChoiceVote,
} as const;

export function ResultEndedEvent({
  content,
  timestamp,
  proposal,
  votes,
}: ResultEndedEventProps) {
  const metadata =
    typeof proposal.metadata === "string"
      ? (JSON.parse(proposal.metadata) as ProposalMetadata)
      : (proposal.metadata as ProposalMetadata);

  const voteType = metadata?.voteType;
  const Component = voteType ? VoteComponents[voteType] : null;

  return (
    <div className="relative flex w-full items-center py-2">
      <div className="flex w-full flex-col rounded-l-xl border bg-white px-4 py-2 pr-8">
        <div className="absolute left-3 top-5 h-[7px] w-[7px] rounded-full border border-white bg-gray-500" />
        <div className="ml-2 flex w-full items-center justify-between">
          <div className="text-sm">{content}</div>
          <Link href="" target="_blank">
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="ml-2 text-sm text-gray-600">
          {Component ? (
            <Component proposal={proposal} votes={votes} />
          ) : (
            <p>Invalid or unsupported vote type: {voteType}</p>
          )}
        </div>
      </div>
    </div>
  );
}
