"use client";

import { DM_Mono } from "next/font/google";
import { useTransition } from "react";
import { useEnsName } from "wagmi";

const dmmono = DM_Mono({
  weight: "400",
  subsets: ["latin"],
});

export const Voter = ({
  address,
  ens,
  removeVoter,
}: {
  address: string;
  ens: string;
  removeVoter: (address: string) => void;
}) => {
  const [, startTransition] = useTransition();

  return (
    <div
      key={address}
      className="flex flex-col items-start gap-2 lg:flex-row lg:items-end lg:gap-12"
    >
      <div className="flex flex-col">
        <div
          className={`${dmmono.className} text-[18px] font-normal leading-[23px] text-white`}
        >
          {ens}
        </div>
        <div
          className={`break-all ${dmmono.className} text-[18px] font-light leading-[23px] text-[#ABABAB]`}
        >
          {address}
        </div>
      </div>

      <button
        onClick={() => {
          startTransition(() => {
            void removeVoter(address);
          });
        }}
        className="text-[18px] font-light text-white underline"
      >
        Delete
      </button>
    </div>
  );
};
