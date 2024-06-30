"use client";

import { Button } from "@/shadcn/ui/button";
import { Manjari } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

const manjari = Manjari({
  weight: "700",
  subsets: ["latin"],
});

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
      router.push("?" + setQuery("state", StateFilterEnum.ALL));
  }, [queryState, router]);

  return (
    <div className={"w-full flex flex-row gap-4"}>
      <Button
        className={`block w-full min-h-14 rounded-lg hover:bg-gold hover:text-luna ${manjari.className}  ${queryState == StateFilterEnum.OPEN ? "bg-dark text-luna" : "bg-luna border-2 border-gold text-gold"}`}
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
        <p className="text-4xl leading-[3.25rem]">open for voting</p>
      </Button>
      <Button
        className={`block w-full min-h-14 rounded-lg hover:bg-gold hover:text-luna ${manjari.className} text-4xl ${queryState == StateFilterEnum.CLOSED ? "bg-dark text-luna" : "bg-luna border-2 border-gold text-gold"}`}
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
        <p className="text-4xl leading-[3.25rem]">closed votes</p>
      </Button>
    </div>
  );
};
