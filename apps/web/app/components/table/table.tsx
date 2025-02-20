import { getProposals } from "@/app/actions";
import { StateFilterEnum } from "../filters/state-filter";
import { ProposalItem } from "./item";
import { LoadMore } from "./load-more";

export const ProposalsTable = async ({
  searchParams,
}: {
  searchParams: {
    state: string;
    dao: string | string[];
  };
}) => {
  const proposals = await getProposals(
    searchParams.state as StateFilterEnum,
    searchParams.dao,
    0,
  );

  return (
    <div className="w-full xl:max-w-[1200px]">
      <div className="flex flex-col gap-4">
        {proposals.map((proposal) => (
          <ProposalItem key={proposal.id} proposal={proposal} />
        ))}
        <LoadMore searchParams={searchParams} />
      </div>
    </div>
  );
};
