"use client";

import { getProposals, getProposalsType } from "@/app/actions";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";
import { StateFilterEnum } from "../filters/state-filter";
import { ProposalItem } from "./item";
import { Manjari } from "next/font/google";

const manjari = Manjari({
  weight: "400",
  subsets: ["latin"],
});

type ItemsProps = {
  searchParams: { state: string; dao: string | string[] };
};

const loadingMessages = [
  "Loading more... DAO-vengers assemble!",
  "Fetching data... checking consensus!",
  "Hang tight... voting in progress!",
  "Loading... DAO proposals coming up!",
  "Fetching... querying the blockchain!",
];

const endMessages = [
  "That's all folks! DAO has spoken.",
  "Congrats! You've seen it all.",
  "Journey ends. DAO decisions in!",
  "End of the road. No more proposals!",
  "Finished! All votes tallied.",
];

export function LoadMore({ searchParams }: ItemsProps) {
  const [proposals, setProposals] = useState<getProposalsType>([]);
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

    const proposals = await getProposals(
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
    setHasMore(true);
    setProposals([]);
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    if (inView) {
      loadMoreItems();
    }
  }, [inView]);

  return (
    <div>
      <div className="flex flex-col gap-4">
        {proposals.map((proposal) => (
          <div key={proposal.id}>
            <ProposalItem proposal={proposal} />
          </div>
        ))}
      </div>

      <div
        className={`${manjari.className} flex w-full justify-center pt-20 text-2xl text-gold`}
      >
        {hasMore ? (
          <div ref={ref}>{loadingMessage}</div>
        ) : (
          <div ref={ref}>{endMessage}</div>
        )}
      </div>
    </div>
  );
}
