"use client";

import { DM_Mono } from "next/font/google";
import { Suspense, useEffect, useState, useTransition } from "react";
import {
  addVoter,
  getVoters,
  type getVotesType,
  removeVoter,
} from "../actions";
import { Voter } from "./voter";

const dmmono = DM_Mono({
  weight: "400",
  subsets: ["latin"],
});

export const Voters = () => {
  const [proxyAddress, setProxyAddress] = useState("");
  const [, startTransition] = useTransition();
  const [voters, setVoters] = useState<getVotesType>([]);

  useEffect(() => {
    const fetchVoters = async () => {
      const v = await getVoters();
      setVoters(v);
    };
    void fetchVoters();
  }, []);

  const onEnter = async () => {
    startTransition(() =>
      addVoter(proxyAddress).then(async () => {
        setProxyAddress("");
        const v = await getVoters();
        setVoters(v);
      }),
    );
  };

  const remove = (address: string) => {
    startTransition(() =>
      removeVoter(address).then(async () => {
        const v = await getVoters();
        setVoters(v);
      }),
    );
  };

  return (
    <div>
      <Suspense>
        <div className="mb-8 flex flex-col gap-4">
          {voters.map((voter, index) => {
            return (
              <Voter
                key={index}
                address={voter.address}
                ens={voter.ens}
                removeVoter={remove}
              />
            );
          })}
        </div>
      </Suspense>

      <div className="flex h-[46px] flex-row items-center">
        <input
          className={`h-full w-full bg-[#D9D9D9] px-2 ${dmmono.className} text-[18px] font-light leading-[23px] text-black lg:w-[480px]`}
          value={proxyAddress}
          onChange={(e) => setProxyAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onEnter();
          }}
          placeholder="Paste a new proxy address here (or ENS)"
        />

        <div
          className={`flex h-full w-[72px] cursor-pointer flex-col justify-center hover:bg-[#999999] ${
            proxyAddress.length ? "bg-white" : "bg-[#ABABAB]"
          } text-center`}
          onClick={() => {
            void onEnter();
          }}
        >
          Add
        </div>
      </div>
    </div>
  );
};
