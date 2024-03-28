"use client";

import { Button } from "@/shadcn/ui/button";
import { useRouter } from "next/navigation";
import { Manjari } from "next/font/google";

const manjari = Manjari({
  weight: "700",
  subsets: ["latin"],
});

export const SignOutButton = () => {
  const router = useRouter();

  const signOut = async () => {
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <Button
      className={`${manjari.className} block min-h-14 rounded-lg hover:border-dark hover:bg-dark hover:text-luna text-4xl bg-luna border-2 border-gold text-gold`}
      onClick={() => {
        signOut().then(() => router.refresh());
      }}
    >
      <p className="text-4xl leading-[3rem]">sign out</p>
    </Button>
  );
};
