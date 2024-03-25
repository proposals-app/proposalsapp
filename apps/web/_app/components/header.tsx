"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import AuthButton from "./auth-button";

const LARGE_HEADER_HEIGHT = "lg:h-[192px] duration-500 transition-all";
const SMALL_HEADER_HEIGHT = "lg:h-[96px] duration-500 transition-all";
const LARGE_TITLE_SIZE = "lg:text-[78px] duration-200 transition-all";
const SMALL_TITLE_SIZE = "lg:text-[52px] duration-200 transition-all";
export function Header({ title }: { title: string }) {
  const [headerHeight, setHeaderHeight] = useState(LARGE_HEADER_HEIGHT);
  const [titleSize, setTitleSize] = useState(LARGE_TITLE_SIZE);
  const pathname = usePathname();

  const handleScroll = useCallback(() => {
    if (
      window.scrollY > 0 &&
      document.body.scrollHeight > window.innerHeight + 100
    ) {
      setHeaderHeight(SMALL_HEADER_HEIGHT);
      setTitleSize(SMALL_TITLE_SIZE);
    } else {
      setHeaderHeight(LARGE_HEADER_HEIGHT);
      setTitleSize(LARGE_TITLE_SIZE);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("wheel", handleScroll);
    handleScroll();
    return () => window.removeEventListener("wheel", handleScroll);
  }, [handleScroll]);

  return (
    <div
      data-testid="header"
      className={`${headerHeight} z-10 flex h-[96px] w-full items-center justify-start border border-x-0 border-t-0 border-[#545454] bg-black px-4 transition-all lg:px-10`}
    >
      <Image
        loading="eager"
        priority={true}
        className="lg:hidden"
        src="/assets/icons/web/logo.svg"
        width={48}
        height={48}
        alt={"Logo"}
      />
      <h1
        className={`${titleSize} text-[26px] font-extrabold text-white transition w-full text-center lg:text-start`}
      >
        {title}
      </h1>

      <div className="flex justify-end text-white lg:hidden">
        <>
          <Dialog.Root>
            <Dialog.Trigger asChild>
              <Image
                loading="eager"
                priority={true}
                src="/assets/icons/web/mobile-menu-open.svg"
                width={48}
                height={48}
                alt={"Menu"}
              />
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="bg-[#1E1B20] bg-opacity-75 data-[state=open]:animate-overlayShow fixed inset-0" />
              <Dialog.Content className="data-[state=open]:animate-contentShow fixed h-full top-[96px] left-[50%] w-full translate-x-[-50%] bg-black p-[25px] shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] focus:outline-none">
                <div className="relative flex flex-row py-6 text-white text-3xl font-bold">
                  <a
                    className={`flex w-full flex-row items-center`}
                    href="/proposals/active"
                  >
                    {pathname?.includes("proposals") ? (
                      <Image
                        loading="eager"
                        priority={true}
                        src="/assets/icons/nav/proposals-active.svg"
                        width={48}
                        height={48}
                        alt={"Proposals"}
                      />
                    ) : (
                      <Image
                        loading="eager"
                        priority={true}
                        src="/assets/icons/nav/proposals-inactive.svg"
                        width={48}
                        height={48}
                        alt={"Proposals Inactive"}
                      />
                    )}
                    Proposals
                  </a>
                </div>

                <div className="relative flex flex-row py-6 text-white text-3xl font-bold">
                  <a
                    className={`flex w-full flex-row items-center`}
                    href="/daos"
                  >
                    {pathname?.includes("daos") ? (
                      <Image
                        loading="eager"
                        priority={true}
                        src="/assets/icons/nav/daos-active.svg"
                        width={48}
                        height={48}
                        alt={"DAOs"}
                      />
                    ) : (
                      <Image
                        loading="eager"
                        priority={true}
                        src="/assets/icons/nav/daos-inactive.svg"
                        width={48}
                        height={48}
                        alt={"DAOs Inactive"}
                      />
                    )}
                    DAOs
                  </a>
                </div>

                <div className="relative flex flex-row py-6 text-white text-3xl font-bold">
                  <a
                    className={`flex w-full flex-row items-center`}
                    href="/settings"
                  >
                    {pathname?.includes("settings") ? (
                      <Image
                        loading="eager"
                        priority={true}
                        src="/assets/icons/nav/settings-active.svg"
                        width={48}
                        height={48}
                        alt={"DAOs"}
                      />
                    ) : (
                      <Image
                        loading="eager"
                        priority={true}
                        src="/assets/icons/nav/settings-inactive.svg"
                        width={48}
                        height={48}
                        alt={"DAOs Inactive"}
                      />
                    )}
                    Settings
                  </a>
                </div>

                <div className="relative w-full flex flex-row justify-center py-6 text-white text-xl font-bold">
                  <Suspense>
                    <AuthButton />
                  </Suspense>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      </div>
      <div className="hidden lg:flex">
        <Suspense>
          <AuthButton />
        </Suspense>
      </div>
    </div>
  );
}
