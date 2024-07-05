"use client";

import { Button } from "@/shadcn/ui/button";
import { useRouter } from "next/navigation";
import { Manjari } from "next/font/google";
import { usePostHog } from "posthog-js/react";

const manjari = Manjari({
  weight: "700",
  subsets: ["latin"],
});

export const SignOutButton = () => {
  const router = useRouter();
  const posthog = usePostHog();

  const signOut = async () => {
    try {
      posthog.reset();
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }).then(() => router.refresh());
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Button
      className={`${manjari.className} block h-[42px] w-fit rounded-lg border-2 border-gold bg-luna text-center text-gold lg:h-[56px]`}
      onClick={() => {
        signOut();
      }}
    >
      <p className="text-[24px] leading-[32px] lg:leading-[46px]">sign out</p>
    </Button>
  );
};
