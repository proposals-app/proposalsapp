"use client";

import { parseAsBoolean, useQueryState } from "nuqs";
import { Checkbox } from "@/shadcn/ui/checkbox";
import { Switch } from "@/shadcn/ui/switch";

export function VersionDiff() {
  const [diff, setDiff] = useQueryState(
    "diff",
    parseAsBoolean.withDefault(false).withOptions({ shallow: false }),
  );

  const [astFirstDiff, setAstFirstDiff] = useQueryState(
    "astDiff",
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

      <div className="flex items-center space-x-2">
        <Switch
          id="astFirstDiff"
          checked={astFirstDiff}
          onCheckedChange={setAstFirstDiff}
        />
        <label
          htmlFor="astFirstDiff"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {astFirstDiff
            ? "Process Markdown Diff Ast First"
            : "Process Markdown Diff Html First"}
        </label>
      </div>
    </div>
  );
}
