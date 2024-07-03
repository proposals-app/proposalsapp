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
    if (!queryState && router) {
      router.push("?" + setQuery("state", StateFilterEnum.ALL));
    }
  }, [queryState, router, setQuery]);

  const buttonClasses = (state: StateFilterEnum) =>
    `block h-[42px] w-full rounded-lg ${manjari.className} text-[24px] leading-[24px] ${
      queryState === state
        ? "bg-dark text-luna"
        : "border-2 border-gold bg-luna text-gold"
    }`;

  return (
    <div className="grid w-full max-w-[400px] grid-cols-1 gap-3 md:grid-cols-2 lg:max-w-full">
      <Button
        className={buttonClasses(StateFilterEnum.OPEN)}
        onClick={() => {
          router.push(
            "?" +
              setQuery(
                "state",
                queryState === StateFilterEnum.OPEN
                  ? StateFilterEnum.ALL
                  : StateFilterEnum.OPEN,
              ),
          );
        }}
      >
        <p className="text-[24px] leading-[36px]">open for voting</p>
      </Button>
      <Button
        className={buttonClasses(StateFilterEnum.CLOSED)}
        onClick={() => {
          router.push(
            "?" +
              setQuery(
                "state",
                queryState === StateFilterEnum.CLOSED
                  ? StateFilterEnum.ALL
                  : StateFilterEnum.CLOSED,
              ),
          );
        }}
      >
        <p className="text-[24px] leading-[36px]">closed votes</p>
      </Button>
    </div>
  );
};
