"use client";

import { getGuestProposals, getGuestProposalsType } from "@/app/actions";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { StateFilterEnum } from "../filters/state-filter";
import { ProposalItem } from "./item";

type ItemsProps = {
  searchParams: { state: string; dao: string | string[] };
};

const loadingMessages = [
  "Loading more",
  "Just a moment, fetching more data...",
  "Hang tight, more content is on its way!",
  "Loading... It'll be worth the wait!",
  "Fetching the next batch of items, please wait...",
];

const endMessages = [
  "That's all folks!",
  "Congratulations! You've seen it all.",
  "And that concludes our journey.",
  "The end of the road has been reached.",
  "No more left to explore, you've arrived at the finish line.",
];

export function LoadMore({ searchParams }: ItemsProps) {
  const [proposals, setProposals] = useState<getGuestProposalsType>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [endMessage, setEndMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  const { ref, inView } = useInView();

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const loadMoreItems = async () => {
    const randomIndex = Math.floor(Math.random() * loadingMessages.length);
    setLoadingMessage(loadingMessages[randomIndex]);

    await delay(1000);
    const nextPage = page + 1;

    const proposals = await getGuestProposals(
      searchParams.state as StateFilterEnum,
      searchParams.dao,
      nextPage,
    );

    if (proposals.length == 0) {
      setHasMore(false);
      setEndMessage(endMessages[randomIndex]);
    }
    setProposals((prevProposals) => [...prevProposals, ...proposals]);
    setPage(nextPage);
  };

  useEffect(() => {
    if (inView) {
      loadMoreItems();
    }
  }, [inView]);

  return (
    <div>
      <div className="flex flex-col gap-6">
        {proposals.map((proposal) => (
          <div key={proposal.id}>
            <ProposalItem proposal={proposal} />
          </div>
        ))}
      </div>

      <div className="w-full flex justify-center p-4">
        {hasMore ? (
          <div ref={ref}>{loadingMessage}</div>
        ) : (
          <div ref={ref}>{endMessage}</div>
        )}
      </div>
    </div>
  );
}
