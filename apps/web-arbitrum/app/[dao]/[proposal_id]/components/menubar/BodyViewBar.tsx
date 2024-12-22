import { ViewEnum } from "@/app/searchParams";
import { ArrowDown, ArrowUp } from "lucide-react";
import { parseAsBoolean, parseAsStringEnum, useQueryState } from "nuqs";

export const BodyViewBar = () => {
  const [view, setView] = useQueryState(
    "view",
    parseAsStringEnum<ViewEnum>(Object.values(ViewEnum))
      .withDefault(ViewEnum.FULL)
      .withOptions({ shallow: false }),
  );

  const [expanded, setExpanded] = useQueryState(
    "expanded",
    parseAsBoolean.withDefault(false).withOptions({ shallow: false }),
  );

  return (
    <div
      className={`fixed bottom-0 z-50 flex w-full max-w-[90%] transform justify-center self-center px-4 pb-4 transition-all duration-300 ease-in md:max-w-[75%] lg:max-w-[48%]`}
    >
      <div className="flex w-full items-center justify-between gap-2 rounded-full border bg-white p-2 text-sm font-bold shadow-lg transition-colors hover:bg-gray-50">
        <div
          className="flex w-full cursor-pointer justify-between hover:underline"
          onClick={() => {
            if (expanded) {
              setView(ViewEnum.FULL);
              setExpanded(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        >
          <ArrowUp className="rounded-full border p-1" />
          <div className="flex flex-row items-center gap-2">
            <div className="px-2">Comments and Votes</div>
            <ArrowDown className="rounded-full border p-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
