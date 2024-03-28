"use client";

import Image from "next/image";
import { SignInButton } from "./auth/sign-in";
import { useSession } from "./session-provider";
import { Profile } from "./auth/profile";
import Link from "next/link";

export const NavBar = () => {
  const { user } = useSession();

  return (
    <div className="w-full flex flex-col gap-8 lg:flex-row lg:gap-0 justify-between items-center">
      <Link
        href="/"
        className="animate-logo-rotate flex flex-row items-center justify-center rounded-xl bg-dark h-full lg:h-14"
      >
        <Image
          width={285}
          height={60}
          src="/assets/icons/web/logo-lettering.svg"
          alt={"proposals.app"}
        />
      </Link>

      <div className="w-full flex justify-end">
        {!user && <SignInButton />}
        {user && <Profile />}
      </div>
    </div>
  );
};
