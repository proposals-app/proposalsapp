"use client";

import Image from "next/image";
import { Suspense } from "react";
import { type fetchItemsType } from "../../../actions";
import { useSession } from "../../../../session-provider";
import moment from "moment/moment";

export default function SnapshotItem(props: {
  item: fetchItemsType["proposals"][0];
}) {
  const { user } = useSession();
  const isConnected = user ? true : false;

  return (
    <div>
      <div className="hidden h-[96px] w-full flex-row justify-between bg-[#121212] text-[#EDEDED] lg:flex">
        <div className="flex flex-row items-center">
          <div className="m-[12px] flex w-[220px] flex-row items-center gap-[8px]">
            <div className=" border border-b-2 border-l-0 border-r-2 border-t-0">
              <Image
                className="min-w-[64px]"
                loading="eager"
                priority={true}
                width={64}
                height={64}
                src={`/${props.item.daoPicture}.svg`}
                alt={props.item.daoName ?? "Unknown"}
              />
            </div>
            <div className="flex h-[70px] min-w-[150px] flex-col justify-between gap-1 pl-2">
              <div className="text-[24px] font-light leading-[22px]">
                {props.item.daoName}
              </div>

              <div>
                <div
                  className={`flex h-[26px] w-[87px] items-center justify-center gap-1 leading-[19px] bg-[#262626] text-[#ABABAB] text-[15px]`}
                >
                  <Image
                    loading="eager"
                    priority={true}
                    width={16}
                    height={16}
                    src={"/assets/icons/chains/snapshot.svg"}
                    alt="off-chain"
                  />
                  <div>offchain</div>
                </div>
              </div>
            </div>
          </div>
          <div className="cursor-pointer hover:underline">
            <a href={`/proposal/${props.item.id}`}>
              <div className="pr-5 text-[18px] font-normal text-wrap min-w-0 max-w-2xl">
                {props.item.name}
              </div>
            </a>
          </div>
        </div>

        <div className="flex flex-row items-center">
          <div className="flex w-[340px] flex-col justify-between gap-2">
            <div className="text-[21px] font-semibold leading-[26px]">
              {moment(props.item.timeEnd).fromNow()}
            </div>

            <div className="text-[15px] font-normal leading-[19px]">
              {moment
                .utc(new Date(props.item.timeEnd))
                .format("on MMMM Do [at] h:mm:ss a")}
            </div>
          </div>

          <div className="w-[200px] text-end">
            <Suspense>
              <div className="flex flex-col items-center">
                {!isConnected && (
                  <div className="p-2 text-center text-[17px] leading-[26px] text-white">
                    Connect wallet to see your vote status
                  </div>
                )}

                {isConnected && props.item.vote.length > 0 && (
                  <div className="flex w-full flex-col items-center">
                    <Image
                      loading="eager"
                      priority={true}
                      src="/assets/icons/web/voted.svg"
                      alt="voted"
                      width={32}
                      height={32}
                    />
                    <div className="text-[18px]">Voted</div>
                  </div>
                )}

                {isConnected && props.item.vote.length == 0 && (
                  <div className="flex w-full flex-col items-center">
                    <Image
                      loading="eager"
                      priority={true}
                      src="/assets/icons/web/not-voted-yet.svg"
                      alt="voted"
                      width={32}
                      height={32}
                    />
                    <div className="text-[18px]">Not Voted Yet</div>
                  </div>
                )}
              </div>
            </Suspense>
          </div>
        </div>
      </div>

      <div className="my-1 flex w-full flex-col items-start bg-[#121212] text-[#EDEDED] lg:hidden">
        <div className="flex w-full flex-col gap-2 p-2">
          <div className="flex flex-row gap-2">
            <div className="flex flex-col items-center gap-2">
              <div className="w-[68px] border border-b-2 border-l-0 border-r-2 border-t-0">
                <Image
                  loading="eager"
                  priority={true}
                  width={68}
                  height={68}
                  src={`/${props.item.daoPicture}.svg`}
                  alt={props.item.daoName ?? "Unknown"}
                />
              </div>

              <div>
                <div
                  className={`flex h-[20px] w-[68px] items-center justify-center gap-1 leading-[19px] bg-[#262626] text-[#ABABAB] text-[12px]`}
                >
                  <Image
                    loading="eager"
                    priority={true}
                    width={12}
                    height={12}
                    src={"/assets/icons/chains/snapshot.svg"}
                    alt="off-chain"
                  />
                  <div>offchain</div>
                </div>
              </div>
            </div>
            <div className="cursor-pointer self-top pb-5 hover:underline">
              <a href={`/proposal/${props.item.id}`}>
                <div className="text-[15px] font-normal leading-[23px] text-wrap min-w-0">
                  {props.item.name}
                </div>
              </a>
            </div>
          </div>

          <div className="flex w-full flex-row items-end justify-between">
            <div className="flex flex-col justify-end">
              <div className="text-start text-[21px] font-semibold leading-[26px]">
                {moment(props.item.timeEnd).fromNow()}
              </div>

              <div className="text-[12px] font-normal leading-[19px]">
                {moment
                  .utc(new Date(props.item.timeEnd))
                  .format("on MMMM Do [at] h:mm:ss a")}
              </div>
            </div>

            <div className="self-end p-2 w-32">
              <Suspense>
                <div className="flex w-full flex-col items-center">
                  {!isConnected && (
                    <div className="p-2 text-center text-[17px] leading-[26px] text-white">
                      Connect wallet to see your vote status
                    </div>
                  )}

                  {isConnected && props.item.vote.length > 0 && (
                    <div className="flex w-full flex-col items-center">
                      <Image
                        loading="eager"
                        priority={true}
                        src="/assets/icons/web/voted.svg"
                        alt="voted"
                        width={32}
                        height={32}
                      />
                      <div className="text-[18px]">Voted</div>
                    </div>
                  )}

                  {isConnected && props.item.vote.length == 0 && (
                    <div className="flex w-full flex-col items-center">
                      <Image
                        loading="eager"
                        priority={true}
                        src="/assets/icons/web/not-voted-yet.svg"
                        alt="voted"
                        width={32}
                        height={32}
                      />
                      <div className="text-[18px]">Not Voted Yet</div>
                    </div>
                  )}
                </div>
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
