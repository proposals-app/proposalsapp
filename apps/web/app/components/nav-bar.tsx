"use client";

import Image from "next/image";
import { SignInButton } from "./auth/sign-in";
import { useSession } from "./session-provider";
import { Profile } from "./auth/profile";
import Link from "next/link";

export const NavBar = () => {
  const { user } = useSession();

  return (
    <div className="w-full flex flex-row justify-between items-center">
      <Link href="/" className="animate-logo-rotate">
        <Image
          className="rounded-xl bg-dark h-14"
          width={285}
          height={60}
          src="/assets/icons/web/logo-lettering.svg"
          alt={"proposals.app"}
        />
      </Link>

      {!user && <SignInButton />}
      {user && <Profile />}
    </div>
  );
};
