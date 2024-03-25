"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LoadingFilters } from "../../components/filters-loading";
import type { getProxiesType } from "../../actions";

const voteOptions: { id: string; name: string }[] = [
  {
    id: "any",
    name: "Any",
  },
  {
    id: "no",
    name: "Not voted on",
  },
  {
    id: "yes",
    name: "Voted on",
  },
];

export const Filters = (props: {
  selectedFrom: string;
  isConnected: boolean;
  subscriptions: { id: string; name: string }[];
  proxies: getProxiesType;
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [from, setFrom] = useState(props.selectedFrom ?? "all");
  const [voted, setVoted] = useState(
    String(searchParams?.get("voted") ?? "any"),
  );
  const [proxy, setProxy] = useState(
    String(searchParams?.get("proxy") ?? "any"),
  );

  useEffect(() => {
    if (router && searchParams)
      if (
        props.selectedFrom != from ||
        searchParams.get("voted") != voted ||
        searchParams.get("proxy") != proxy
      )
        router.push(
          `/proposals/active/${from.replaceAll(" ", "_")}?&voted=${voted}&proxy=${proxy}`,
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, from, voted, proxy]);

  return (
    <Suspense fallback={<LoadingFilters />}>
      <div className="mt-[16px] flex flex-col overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="flex h-[38px] w-full flex-row items-center lg:w-[300px]">
            <label
              className="flex h-full min-w-max items-center bg-black px-[12px] py-[9px] text-[15px] text-white"
              htmlFor="from"
            >
              From
            </label>
            <select
              className="h-full w-full text-black"
              id="from"
              onChange={(e) => {
                setFrom(e.target.value);
              }}
              value={from}
            >
              {props.isConnected && props.subscriptions.length > 0 ? (
                <>
                  <option key="all" value="all">
                    All Subscribed Organisations
                  </option>
                </>
              ) : (
                <>
                  <option key="all" value="all">
                    All Organisations
                  </option>
                </>
              )}

              {props.subscriptions
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((sub) => {
                  return (
                    <option
                      key={sub.name.toLowerCase()}
                      value={sub.name.toLowerCase()}
                    >
                      {sub.name}
                    </option>
                  );
                })}
            </select>
          </div>

          {props.isConnected && (
            <div className="flex h-[38px] w-full flex-row items-center lg:w-[300px]">
              <label
                className="flex h-full min-w-max items-center bg-black px-[12px] py-[9px] text-[15px] text-white"
                htmlFor="voted"
              >
                <div>With Vote Status of</div>
              </label>
              <select
                className="h-full w-full text-black"
                id="voted"
                onChange={(e) => {
                  setVoted(String(e.target.value));
                }}
                value={voted}
              >
                {voteOptions.map((voteOption) => {
                  return (
                    <option key={voteOption.id} value={voteOption.id}>
                      {voteOption.name}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
          {props.proxies.length > 1 && (
            <div className="flex h-[38px] w-full flex-row items-center lg:w-[300px]">
              <label
                className="flex h-full min-w-max items-center bg-black px-[12px] py-[9px] text-[15px] text-white"
                htmlFor="voted"
              >
                <div>And Showing Votes From</div>
              </label>
              <select
                className="h-full w-full text-black"
                id="voted"
                onChange={(e) => {
                  setProxy(String(e.target.value));
                }}
                value={proxy}
              >
                <option key="any" value="any">
                  Any
                </option>
                {props.proxies.map((proxy) => {
                  return (
                    <option key={proxy.address} value={proxy.address}>
                      {proxy.ens ?? proxy.address}
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </div>
    </Suspense>
  );
};
