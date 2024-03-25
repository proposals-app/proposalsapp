"use client";

import { Button } from "@/shadcn/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

export const StateFilter = () => {
  const searchParams = useSearchParams();
  const queryState = searchParams.get("state");
  const router = useRouter();

  const setQuery = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(name, value);

      return params.toString();
    },
    [searchParams],
  );

  useEffect(() => {
    if (!queryState && router) router.push("?" + setQuery("state", "all"));
  }, [queryState, router]);

  return (
    <div className="w-full h-[60px] rounded flex flex-row gap-2">
      <Button
        className="w-full"
        variant={queryState == "active" ? "default" : "secondary"}
        onClick={() => {
          router.push(
            "?" + setQuery("state", queryState == "active" ? "all" : "active"),
          );
        }}
      >
        active proposals
      </Button>
      <Button
        className="w-full"
        variant={queryState == "past" ? "default" : "secondary"}
        onClick={() => {
          router.push(
            "?" + setQuery("state", queryState == "past" ? "all" : "past"),
          );
        }}
      >
        past proposals
      </Button>
    </div>
  );
};
