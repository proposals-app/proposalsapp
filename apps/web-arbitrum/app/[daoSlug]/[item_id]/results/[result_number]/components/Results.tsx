"use client";

import { useEffect, useState } from "react";
import { ProcessedResults } from "./actions";
import { Proposal, Selectable, Vote } from "@proposalsapp/db";
import { LoadingVotes } from "./result/LoadingVotes";
import { VotingPowerChart } from "./result/VotingPowerChart";
import { VotingTable } from "./result/VotingTable";

interface ResultsProps {
  proposal: Selectable<Proposal>;
  getVotesAction: (proposalId: string) => Promise<Selectable<Vote>[]>;
  processResultsAction: (
    proposal: Selectable<Proposal>,
    votes: Selectable<Vote>[],
  ) => Promise<ProcessedResults>;
}

export function Results({
  proposal,
  getVotesAction,
  processResultsAction,
}: ResultsProps) {
  const [results, setResults] = useState<ProcessedResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      const votes = await getVotesAction(proposal.id);
      const processedResults = await processResultsAction(proposal, votes);
      setResults(processedResults);
      setLoading(false);
    };

    fetchResults();
  }, [proposal, getVotesAction, processResultsAction]);

  if (loading) {
    return <LoadingVotes />;
  }

  return (
    <div>
      <VotingPowerChart results={results!} />
      <VotingTable results={results!} />
    </div>
  );
}
