import { Suspense } from "react";
import { getHotDaos } from "../../actions";
import { DaosFilter } from "./daos-filter";
import { StateFilter } from "./state-filter";

export const Filters = async () => {
  const hotDaos = await getHotDaos();

  return (
    <div className="flex w-full flex-col items-center">
      <div className="flex flex-col items-center gap-3">
        <Suspense>
          <StateFilter />
          <DaosFilter hotDaos={hotDaos} />
        </Suspense>

        {/* <DatePickerWithRange className="justify-end" /> */}
      </div>
    </div>
  );
};
