import Link from "next/link";
import { type getOwnVotesType } from "../actions";
import type { ProposalStateEnum } from "@proposalsapp/db";

export default async function Vote({
  proposalId,
  proposalState,
  choices,
  url,
  ownVotes,
}: {
  proposalId: string;
  proposalState: ProposalStateEnum;
  choices: any[];
  url: string;
  ownVotes: getOwnVotesType;
}) {
  return (
    <div className="p-4 bg-[#121212] flex flex-col">
      <div
        className={`lg:text-[42px] text-[26px] font-extrabold text-white transition w-full text-center lg:text-start pb-2`}
      >
        Vote
      </div>

      <div className="flex flex-col p-4 gap-2 break-all text-white whitespace-pre-line max-h-screen">
        {ownVotes.length != 0 && (
          <div className="flex flex-col gap-8">
            {ownVotes.map((v) => (
              <div key={v.blockCreated} className="flex flex-col gap-0">
                <div className="w-full text-left text-xl font-bold">
                  🗳️ {choices[v.choice as any]}
                </div>
                <div className="w-full text-left text-xs font-mono truncate">
                  {v.voterAddress}
                </div>
              </div>
            ))}
          </div>
        )}

        {proposalState == "ACTIVE" && ownVotes.length == 0 && (
          <Link href={url} target="_blank" rel="noreferrer">
            <div className="w-full bg-white text-black font-bold p-2 text-center">
              Cast your vote
            </div>
          </Link>
        )}

        {proposalState == "ACTIVE" && ownVotes.length > 0 && (
          <Link href={url} target="_blank" rel="noreferrer">
            <div className="w-full bg-white text-black font-bold p-2 text-center">
              Change your vote
            </div>
          </Link>
        )}

        {proposalState != "ACTIVE" && proposalState != "EXECUTED" && (
          <div className="w-full bg-stone-500 text-black font-bold p-2 text-center">
            Voting is not active
          </div>
        )}

        {(proposalState == "EXECUTED" || proposalState == "CANCELED") && (
          <div className="w-full bg-stone-500 text-black font-bold p-2 text-center">
            Voting ended
          </div>
        )}
      </div>
    </div>
  );
}
