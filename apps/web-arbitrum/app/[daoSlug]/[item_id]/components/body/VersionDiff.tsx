"use client";

import { parseAsBoolean, useQueryState } from "nuqs";
import { Checkbox } from "@/shadcn/ui/checkbox";

export function VersionDiff() {
  const [diff, setDiff] = useQueryState(
    "diff",
    parseAsBoolean.withDefault(false).withOptions({ shallow: false }),
  );

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="diff"
          checked={diff}
          onCheckedChange={(checked) => {
            if (checked === "indeterminate") {
              setDiff(false);
            } else {
              setDiff(checked);
            }
          }}
        />
        <label
          htmlFor="diff"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Show Diff
        </label>
      </div>
    </div>
  );
}
