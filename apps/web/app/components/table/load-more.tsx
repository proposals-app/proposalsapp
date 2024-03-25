"use client";

import { getGuestProposals, getGuestProposalsType } from "@/app/actions";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { StateFilterEnum } from "../filters/state-filter";
import { ProposalItem } from "./item";

type ItemsProps = {
  searchParams: { state: string; dao: string | string[] };
};

export function LoadMore({ searchParams }: ItemsProps) {
  const [proposals, setProposals] = useState<getGuestProposalsType>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const { ref, inView } = useInView();

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const loadMoreItems = async () => {
    await delay(1000);
    const nextPage = page + 1;

    const proposals = await getGuestProposals(
      searchParams.state as StateFilterEnum,
      searchParams.dao,
      nextPage,
    );

    if (proposals.length == 0) setHasMore(false);
    setProposals((prevProposals) => [...prevProposals, ...proposals]);
    setPage(nextPage);
  };

  useEffect(() => {
    if (inView) {
      loadMoreItems();
    }
  }, [inView]);

  return (
    <>
      <ul>
        {proposals.map((proposal) => (
          <li key={proposal.id}>
            <ProposalItem proposal={proposal} />
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div ref={ref}>Loading more</div>
      ) : (
        <div ref={ref}>You reached the end</div>
      )}
    </>
  );
}
