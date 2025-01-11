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

export type VoteType =
  | "single-choice"
  | "weighted"
  | "approval"
  | "basic"
  | "quadratic"
  | "ranked-choice";

export interface Proposal extends Omit<Selectable<DbProposal>, "metadata"> {
  metadata: ProposalMetadata | JsonValue;
}

interface ResultEventProps {
  content: string;
  timestamp: Date;
  proposal: Proposal;
  votes: Selectable<Vote>[];
  resultNumber: number;
  last: boolean;
  daoSlug: string;
  groupId: string;
}

const VoteComponents = {
  "single-choice": SingleChoiceVote,
  weighted: WeightedVote,
  approval: ApprovalVote,
  basic: BasicVote,
  quadratic: QuadraticVote,
  "ranked-choice": RankedChoiceVote,
} as const;

export function ResultEvent({
  content,
  timestamp,
  proposal,
  votes,
  resultNumber,
  last,
  daoSlug,
  groupId,
}: ResultEventProps) {
  const metadata =
    typeof proposal.metadata === "string"
      ? (JSON.parse(proposal.metadata) as ProposalMetadata)
      : (proposal.metadata as ProposalMetadata);

  const voteType = metadata?.voteType;
  const Component = voteType ? VoteComponents[voteType] : null;

  return (
    <div className="relative flex w-full items-center py-2">
      <div className="flex w-full flex-col gap-1 rounded-l-xl border bg-white px-4 py-2 pr-8">
        <div className="absolute left-3 top-5 z-20 h-[7px] w-[7px] rounded-full bg-gray-500" />
        {!last && (
          <div className="absolute left-3 top-[7px] z-10 h-[15px] max-h-[15px] w-0.5 translate-x-[2.5px] bg-gray-300" />
        )}
        <div className="ml-2 flex w-full items-center justify-between">
          <div className="text-xs">{content}</div>
          <Link
            href={`/${daoSlug}/${groupId}/results/${resultNumber}`} // Link to the results page
            className="text-blue-500 hover:underline"
          >
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
