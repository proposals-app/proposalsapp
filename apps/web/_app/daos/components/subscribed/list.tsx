import { Suspense } from "react";
import { type SubscribedDAOsType } from "../../actions";
import { SubscribedDAO } from "./card";

export default async function SubscribedDAOs({
  subscribed,
}: {
  subscribed: SubscribedDAOsType;
}) {
  if (subscribed.length === 0) return null;

  return (
    <main className="mb-10">
      <p className="mb-4 w-full text-[36px] font-bold leading-[36px] text-white">
        Your DAOs
      </p>

      <Suspense>
        <ul
          data-testid="subscribed-list"
          className="grid grid-cols-1 place-items-center gap-10 min-[650px]:grid-cols-2 min-[900px]:grid-cols-3 lg:place-items-start min-[1200px]:grid-cols-4 min-[1500px]:grid-cols-5 min-[1800px]:grid-cols-6 min-[2200px]:grid-cols-7 min-[2300px]:grid-cols-8 min-[2500px]:grid-cols-9 min-[3000px]:grid-cols-10"
        >
          {subscribed.map((entry) => (
            <SubscribedDAO
              key={entry.id}
              daoId={entry.id}
              daoName={entry.name}
              daoPicture={entry.picture ?? ""}
              bgColor={entry.backgroundColor ?? "#000000"}
              daoHandlers={entry.handlers.map((handler) => handler.handlerType)}
              activeProposals={entry.activeProposalsCount as number}
            />
          ))}
        </ul>
      </Suspense>
    </main>
  );
}
