import { getGuestProposals } from "@/app/actions";
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
  const proposals = await getGuestProposals(
    searchParams.state as StateFilterEnum,
    searchParams.dao,
    0,
  );

  return (
    <div className="w-full">
      <div className="w-full flex flex-row">
        <div className="w-16">DAO</div>
        <div className="w-full">Proposal Title</div>
        <div className="min-w-32 text-end">Deadline</div>
      </div>

      <div>
        {proposals.map((proposal) => (
          <ProposalItem key={proposal.id} proposal={proposal} />
        ))}
        <LoadMore searchParams={searchParams} />
      </div>
    </div>
  );
};
