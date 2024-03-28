"use client";

import { Button } from "@/shadcn/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

export enum StateFilterEnum {
  ALL = "all",
  OPEN = "open",
  CLOSED = "closed",
}

export const StateFilter = () => {
  const searchParams = useSearchParams();
  const queryState = searchParams.get("state");
  const router = useRouter();

  const setQuery = useCallback(
    (name: string, value: StateFilterEnum) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(name, value.toString());

      return params.toString();
    },
    [searchParams],
  );

  useEffect(() => {
    if (!queryState && router)
      router.push("?" + setQuery("state", StateFilterEnum.OPEN));
  }, [queryState, router]);

  return (
    <div className="w-full h-[60px] rounded flex flex-row gap-2">
      <Button
        className={`w-full ${queryState == StateFilterEnum.OPEN ? "bg-dark" : "bg-luna border-2 border-gold text-gold"}`}
        onClick={() => {
          router.push(
            "?" +
              setQuery(
                "state",
                queryState == StateFilterEnum.OPEN
                  ? StateFilterEnum.ALL
                  : StateFilterEnum.OPEN,
              ),
          );
        }}
      >
        open for voting
      </Button>
      <Button
        className={`w-full ${queryState == StateFilterEnum.CLOSED ? "bg-dark" : "bg-luna border-2 border-gold text-gold"}`}
        onClick={() => {
          router.push(
            "?" +
              setQuery(
                "state",
                queryState == StateFilterEnum.CLOSED
                  ? StateFilterEnum.ALL
                  : StateFilterEnum.CLOSED,
              ),
          );
        }}
      >
        closed votes
      </Button>
    </div>
  );
};
