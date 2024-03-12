"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { unsubscribe } from "./actions";

export const SubscribedDAO = (props: {
  daoId: string;
  daoName: string;
  daoPicture: string;
  bgColor: string;
  daoHandlers: string[];
  activeProposals: number;
}) => {
  const [imgSrc, setImgSrc] = useState(
    props.daoPicture
      ? props.daoPicture + "_medium.png"
      : '/assets/project-logos/placeholder_medium.png',
  );

  useEffect(() => {
    setImgSrc(
      props.daoPicture
        ? props.daoPicture + "_medium.png"
        : '/assets/project-logos/placeholder_medium.png',
    );
  }, [props.daoPicture]);

  const [showMenu, setShowMenu] = useState(false);

  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  return (
    <li
      data-testid={props.daoName}
      className={`h-[320px] w-[240px] ${
        loading ? 'pointer-events-none animate-pulse opacity-25' : 'opacity-100'
      }`}
    >
      {showMenu ? (
        <div
          className={`relative flex h-full w-full flex-col rounded bg-black text-sm font-bold text-white shadow`}
        >
          <div className="flex h-full flex-col justify-between">
            <div className="flex w-full flex-row items-start justify-between px-4 pt-4">
              <div className="justify-center  text-center text-[21px] font-semibold leading-8">
                {props.daoName}
              </div>
              <div
                className="cursor-pointer"
                onClick={() => {
                  setShowMenu(false);
                }}
              >
                <Image
                  loading="eager"
                  priority={true}
                  width="32"
                  height="32"
                  src="/assets/icons/web/close.svg"
                  alt="close button"
                />
              </div>
            </div>
            <div className="flex h-full flex-col gap-4 px-4 pt-4">
              <div className="text-[15px] font-thin leading-[19px]">
                You are currently subscribed to follow the off-chain and onchain
                proposals of {props.daoName}.
              </div>
              <div className="text-[15px] font-thin leading-[19px]">
                You are also getting daily updates on these proposals on your
                email.
              </div>
              <div className="text-[15px] font-thin leading-[19px]">
                Do you wish to unsubscribe from {props.daoName}?
              </div>
            </div>

            <div
              data-testid="unsubscribe-button"
              className="w-full cursor-pointer  px-4 pb-4 text-center text-[15px] font-thin text-white underline"
              onClick={() => {
                startTransition(() => unsubscribe(props.daoId));
                setLoading(true);
              }}
            >
              Unsubscribe from {props.daoName}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            backgroundImage: `linear-gradient(45deg, ${props.bgColor}40 15%, ${props.bgColor}10)`,
            filter: "saturate(5)",
          }}
          className="relative flex h-full w-full flex-col rounded text-sm font-bold text-white shadow"
        >
          <div className="absolute flex w-full flex-col items-end pr-4 pt-4">
            <div
              data-testid="menu-button"
              className="cursor-pointer"
              onClick={() => {
                setShowMenu(true);
              }}
            >
              <Image
                loading="eager"
                priority={true}
                width="32"
                height="32"
                src="/assets/icons/web/menu.svg"
                alt="menu button"
              />
            </div>
          </div>
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
                setImgSrc("/assets/project-logos/placeholder_medium.png");
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
            <div
              className={
                props.activeProposals > 0
                  ? "cursor-pointer pb-1 pt-6 text-[15px] font-thin text-white text-opacity-80 underline decoration-from-font underline-offset-2 hover:text-opacity-100"
                  : "pb-1 pt-6 text-[15px] font-thin text-white text-opacity-80"
              }
            >
              {props.activeProposals > 0 ? (
                <Link
                  href={`/proposals/active?from=${props.daoName.toLowerCase()}`}
                >
                  {`${props.activeProposals} Active Proposals`}
                </Link>
              ) : (
                "No Active Proposals"
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
};
