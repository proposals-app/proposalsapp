import { ViewEnum } from "@/app/searchParams";
import { cn } from "@/shadcn/lib/utils";
import { Label } from "@/shadcn/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shadcn/ui/pagination";
import { Switch } from "@/shadcn/ui/switch";
import { ArrowDown, ArrowUp } from "lucide-react";
import Link from "next/link";
import {
  parseAsBoolean,
  parseAsInteger,
  parseAsStringEnum,
  useQueryState,
} from "nuqs";

export const BodyViewBar = ({ totalVersions }: { totalVersions: number }) => {
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

  const [diff, setDiff] = useQueryState(
    "diff",
    parseAsBoolean.withDefault(false).withOptions({ shallow: false }),
  );

  const [version, setVersion] = useQueryState(
    "version",
    parseAsInteger.withOptions({ shallow: false }),
  );

  const currentVersion = version ?? 0;
  return (
    <div
      className={`fixed bottom-0 z-50 flex w-full max-w-[90%] justify-center self-center px-4 pb-4 transition-transform duration-300 md:max-w-[75%] lg:max-w-[48%] ${
        view === ViewEnum.BODY ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2 rounded-full border bg-white p-2 text-sm font-bold shadow-lg transition-colors hover:bg-gray-50">
        <div className="flex w-full justify-between">
          <div className="flex items-center gap-4">
            <Link href="#">
              <ArrowUp className="h-8 w-8 rounded-full border p-1" />
            </Link>
            <div className="flex items-center gap-2 text-nowrap">
              <Switch
                id="changes"
                checked={diff}
                onCheckedChange={(checked) => setDiff(checked)}
              />
              <Label htmlFor="changes">Show changes</Label>
            </div>
          </div>

          <Pagination>
            <PaginationContent className={cn(`h-8`)}>
              <PaginationItem className={cn(`cursor-pointer`)}>
                <PaginationPrevious
                  onClick={() => setVersion(Math.max(0, currentVersion - 1))}
                  isActive={currentVersion != 0}
                  className={cn(`h-8 select-none`)}
                />
              </PaginationItem>
              <PaginationItem className={cn(`pointer-events-none`)}>
                <PaginationLink className={cn(`w-full`)}>
                  Version {currentVersion + 1} of {totalVersions}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem className={cn(`cursor-pointer`)}>
                <PaginationNext
                  onClick={() =>
                    setVersion(Math.min(totalVersions - 1, currentVersion + 1))
                  }
                  isActive={currentVersion != totalVersions - 1}
                  className={cn(`h-8 select-none`)}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <div
            className="flex cursor-pointer flex-row items-center gap-4 text-nowrap hover:underline"
            onClick={() => {
              if (expanded) {
                setView(ViewEnum.FULL);
                setExpanded(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            <div>Comments and Votes</div>
            <ArrowDown className="h-8 w-8 rounded-full border p-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
