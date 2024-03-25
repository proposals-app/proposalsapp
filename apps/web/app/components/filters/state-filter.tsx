"use client";

import { Button } from "@/shadcn/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

export enum StateFilterEnum {
  ALL = "all",
  ACTIVE = "active",
  PAST = "past",
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
      router.push("?" + setQuery("state", StateFilterEnum.ALL));
  }, [queryState, router]);

  return (
    <div className="w-full h-[60px] rounded flex flex-row gap-2">
      <Button
        className="w-full"
        variant={queryState == StateFilterEnum.ACTIVE ? "default" : "secondary"}
        onClick={() => {
          router.push(
            "?" +
              setQuery(
                "state",
                queryState == StateFilterEnum.ACTIVE
                  ? StateFilterEnum.ALL
                  : StateFilterEnum.ACTIVE,
              ),
          );
        }}
      >
        active proposals
      </Button>
      <Button
        className="w-full"
        variant={queryState == StateFilterEnum.PAST ? "default" : "secondary"}
        onClick={() => {
          router.push(
            "?" +
              setQuery(
                "state",
                queryState == StateFilterEnum.PAST
                  ? StateFilterEnum.ALL
                  : StateFilterEnum.PAST,
              ),
          );
        }}
      >
        past proposals
      </Button>
    </div>
  );
};
