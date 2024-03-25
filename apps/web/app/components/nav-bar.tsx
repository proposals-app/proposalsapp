"use client";

import Image from "next/image";
import { SignInButton } from "./auth/sign-in";
import { useSession } from "./session-provider";
import { Profile } from "./auth/profile";

export const NavBar = () => {
  const { user } = useSession();

  return (
    <div className="w-full flex flex-row justify-between items-center">
      <div className="w-fit animate-logo-rotate">
        <Image
          className="w-20 h-20 border-4 border-white rounded-xl bg-foreground"
          width={64}
          height={64}
          src="/assets/icons/web/logo.svg"
          alt={"proposals.app"}
        />
      </div>

      {!user && <SignInButton />}
      {user && <Profile />}
    </div>
  );
};
