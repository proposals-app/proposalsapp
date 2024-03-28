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
      <Link href="/" className="max-w-[50%] animate-logo-rotate">
        <Image
          className="border-4 border-white rounded-xl bg-foreground"
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
