import { Suspense } from "react";
import { getHotDaos } from "../../actions";
import { DaosFilter } from "./daos-filter";
import { StateFilter } from "./state-filter";

export const Filters = async () => {
  const hotDaos = await getHotDaos();

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center gap-3 lg:max-w-full">
      <Suspense>
        <StateFilter />
        <DaosFilter hotDaos={hotDaos} />
      </Suspense>
    </div>
  );
};
