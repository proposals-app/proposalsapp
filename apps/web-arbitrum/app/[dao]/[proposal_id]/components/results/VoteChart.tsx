import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { SingleChoiceVoteChart } from "./SingleChoiceVoteChart";
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

  console.log(`proposal.metadata: ${JSON.stringify(proposal.metadata)}`);
  console.log(`snapshotType: ${snapshotType}`);

  switch (snapshotType) {
    case "single-choice":
      return <SingleChoiceVoteChart proposal={proposal} />;
    case "weighted":
      return <WeightedVoteChart proposal={proposal} />;
    case "approval":
      return <ApprovalVoteChart proposal={proposal} />;
    case "quadratic": // New case
      return <QuadraticVoteChart proposal={proposal} />;
    case "ranked-choice": // New case
      return <RankedChoiceVoteChart proposal={proposal} />;
    default:
      return <BasicVoteChart proposal={proposal} />;
  }
}
