"use client";

import { parseAsInteger, useQueryState } from "nuqs";

export function VersionChange({
  toVersion,
  dir,
  disabled,
}: {
  toVersion: number;
  dir: "inc" | "dec";
  disabled: boolean;
}) {
  const [_, setVersion] = useQueryState(
    "version",
    parseAsInteger.withOptions({ shallow: false }),
  );

  return (
    <button
      className={`flex w-12 flex-col items-center rounded-lg border bg-white p-2 disabled:bg-gray-200`}
      onClick={() => {
        setVersion(toVersion);
      }}
      disabled={disabled}
    >
      {dir == "inc" ? <span>&gt;</span> : <span>&lt;</span>}
    </button>
  );
}
