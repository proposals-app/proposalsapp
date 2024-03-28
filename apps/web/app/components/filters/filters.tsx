import { Suspense } from "react";
import { getHotDaos } from "../../actions";
import { DaosFilter } from "./daos-filter";
import { StateFilter } from "./state-filter";

export const Filters = async () => {
  const hotDaos = await getHotDaos();

  return (
    <div>
      <div className="flex flex-col gap-[18px] px-2">
        <Suspense>
          <StateFilter />
          <DaosFilter hotDaos={hotDaos} />
        </Suspense>

        {/* <DatePickerWithRange className="justify-end" /> */}
      </div>
    </div>
  );
};
