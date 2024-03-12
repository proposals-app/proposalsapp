"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { subscribe } from "./actions";

export const UnsubscribedDAO = (props: {
  daoId: string;
  daoName: string;
  daoPicture: string;
  bgColor: string;
  daoHandlers: string[];
}) => {
  const [imgSrc, setImgSrc] = useState(
    props.daoPicture
      ? props.daoPicture + "_medium.png"
      : "/assets/Project_Icons/placeholder_medium.png",
  );

  useEffect(() => {
    setImgSrc(
      props.daoPicture
        ? props.daoPicture + "_medium.png"
        : "/assets/Project_Icons/placeholder_medium.png",
    );
  }, [props.daoPicture]);

  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  return (
    <li
      data-testid={props.daoName}
      className={`h-[320px] w-[240px] ${
        loading ? "pointer-events-none animate-pulse opacity-25" : "opacity-100"
      }`}
    >
      <div
        style={{
          backgroundImage: `linear-gradient(45deg, ${props.bgColor}40 15%, ${props.bgColor}10)`,
          filter: "saturate(5)",
        }}
        className={`relative flex h-full w-full flex-col rounded text-sm font-bold text-white shadow`}
      >
        <div className="flex grow flex-col items-center justify-end px-6 pb-6">
          <Image
            loading="eager"
            priority={true}
            style={{
              filter: "saturate(0.2)",
            }}
            width="96"
            height="96"
            src={imgSrc}
            onError={() => {
              setImgSrc("/assets/Project_Icons/placeholder_medium.png");
            }}
            quality="100"
            alt="dao logo"
          />
          <div className="pt-6 text-center text-[36px] font-thin leading-8">
            {props.daoName}
          </div>
          <div className="flex flex-row gap-4 pt-6 opacity-50">
            {props.daoHandlers.map((handler, index: number) => {
              if (handler.endsWith("SNAPSHOT"))
                return (
                  <Image
                    loading="eager"
                    priority={true}
                    key={index}
                    width="24"
                    height="24"
                    src="/assets/icons/chains/logos/snapshot/on-dark.svg"
                    alt="snapshot proposals"
                  />
                );
              else if (handler.endsWith("MAINNET"))
                return (
                  <Image
                    loading="eager"
                    priority={true}
                    key={index}
                    width="24"
                    height="24"
                    src="/assets/icons/chains/logos/ethereum/on-dark.svg"
                    alt="ethereum proposals"
                  />
                );
              if (handler.endsWith("ARBITRUM"))
                return (
                  <Image
                    loading="eager"
                    priority={true}
                    key={index}
                    width="24"
                    height="24"
                    src="/assets/icons/chains/logos/arbitrum/on-dark.svg"
                    alt="arbitrum proposals"
                  />
                );
              if (handler.endsWith("OPTIMISM"))
                return (
                  <Image
                    loading="eager"
                    priority={true}
                    key={index}
                    width="24"
                    height="24"
                    src="/assets/icons/chains/logos/optimism/on-dark.svg"
                    alt="optimism proposals"
                  />
                );
              if (handler.endsWith("POLYGON_POS"))
                return (
                  <Image
                    loading="eager"
                    priority={true}
                    key={index}
                    width="24"
                    height="24"
                    src="/assets/icons/chains/logos/polygon/on-dark.svg"
                    alt="polygon proposals"
                  />
                );
              if (handler.endsWith("AVALANCHE"))
                return (
                  <Image
                    loading="eager"
                    priority={true}
                    key={index}
                    width="24"
                    height="24"
                    src="/assets/icons/chains/logos/avalanche/on-dark.svg"
                    alt="avalanche proposals"
                  />
                );
            })}
          </div>
        </div>

        <button
          data-testid="subscribe-button"
          className="h-14 w-full bg-white text-xl font-bold text-black hover:bg-neutral-100 active:bg-neutral-300"
          onClick={() => {
            startTransition(() => subscribe(props.daoId));
            setLoading(true);
          }}
        >
          Subscribe
        </button>
      </div>
    </li>
  );
};
