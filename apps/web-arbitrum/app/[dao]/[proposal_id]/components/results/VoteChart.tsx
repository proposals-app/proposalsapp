import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { WeightedVoteChart } from "./WeightedVoteChart";
import { ApprovalVoteChart } from "./ApprovalVoteChart";
import { BasicVoteChart } from "./BasicVoteChart";
import { QuadraticVoteChart } from "./QuadraticVoteChart";
import { RankedChoiceVoteChart } from "./RankedChoiceVoteChart";

interface ResultProps {
  proposal: Selectable<Proposal> & {
    votes: Selectable<Vote>[];
  };
}

// Type guard to check if metadata is a JsonObject
function isJsonObject(value: any): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function VoteChart({ proposal }: ResultProps) {
  // Ensure metadata is treated as a JSON object
  let snapshotType = "basic";

  if (isJsonObject(proposal.metadata)) {
    const metadata = proposal.metadata as Record<string, any>;
    snapshotType = (metadata.snapshotType || "basic") as
      | "single-choice"
      | "weighted"
      | "approval"
      | "basic"
      | "quadratic"
      | "ranked-choice";
  }

  switch (snapshotType) {
    case "weighted":
      return <WeightedVoteChart proposal={proposal} />;
    case "approval":
      return <ApprovalVoteChart proposal={proposal} />;
    case "quadratic":
      return <QuadraticVoteChart proposal={proposal} />;
    case "ranked-choice":
      return <RankedChoiceVoteChart proposal={proposal} />;
    case "single-choice":
    case "basic":
      return <BasicVoteChart proposal={proposal} />;
    default:
      return <BasicVoteChart proposal={proposal} />;
  }
}
