import { getOwnVotes, getProposalWithDao } from "./actions";
import LinkPreview from "./components/discussion";
import Body from "./components/body";
import Title from "./components/title";
import { Suspense } from "react";
import Vote from "./components/vote";
import { VotesWrapper } from "./votes/page";
import GovernancePortal from "./components/governance-portal";

export default async function Page({
  params,
}: {
  params: { proposalid: string };
}) {
  let proposal = await getProposalWithDao(params.proposalid);
  let ownVotes = await getOwnVotes(params.proposalid);
  return (
    <div className="bg-[#1E1B20] flex flex-col">
      <Title title={proposal.name} daoImage={proposal.daoPicture} />

      <div className="p-5 lg:p-10">
        <div className="flex min-h-screen w-full grow flex-col gap-4">
          <div className="flex flex-col-reverse lg:flex-row gap-4">
            <Body body={proposal.body} />

            <div className="flex flex-col gap-4 lg:min-w-[30%] lg:max-w-[30%]">
              <Suspense
                fallback={
                  <div className="p-4 bg-[#121212] flex flex-col">
                    <div
                      className={`lg:text-[42px] text-[26px] font-extrabold text-white transition w-full text-center lg:text-start pb-2`}
                    >
                      Votes
                    </div>
                    <div className="h-72 flex flex-col p-2 gap-2 text-white whitespace-pre-line w-full animate-pulse bg-[#242424]" />
                  </div>
                }
              >
                <VotesWrapper
                  proposalId={proposal.id}
                  choices={proposal.choices as any[]}
                  quorum={proposal.quorum}
                />
              </Suspense>
              <Vote
                proposalId={proposal.id}
                proposalState={proposal.proposalState}
                choices={proposal.choices as any[]}
                url={proposal.url}
                ownVotes={ownVotes}
              />
              <GovernancePortal url={proposal.url} />
            </div>
          </div>
          <LinkPreview url={proposal.discussionUrl} />
        </div>
      </div>
    </div>
  );
}
