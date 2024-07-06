"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/shadcn/ui/alert-dialog";
import { Manjari, Poppins } from "next/font/google";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shadcn/ui/button";

const manjari = Manjari({
  weight: "700",
  subsets: ["latin"],
});

const poppins300 = Poppins({
  weight: "300",
  subsets: ["latin"],
});

const poppins700 = Poppins({
  weight: "700",
  subsets: ["latin"],
});

export const OnboardingPushNotificationsModal = () => {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        className={cn(
          `flex h-screen w-full flex-col items-center bg-luna px-4 pt-32 lg:h-fit lg:max-h-[70vh] lg:min-h-[400px] lg:max-w-2xl lg:rounded-3xl lg:p-12`,
        )}
      >
        <AlertDialogCancel asChild>
          <Image
            className="absolute left-4 top-12 h-[48px] w-[48px] cursor-pointer lg:left-2 lg:top-2"
            src="/assets/icons/web/new/close-button.svg"
            alt="close button"
            width={48}
            height={48}
            onClick={() => {
              setOpen(!open);
            }}
            style={{
              maxWidth: "100%",
              height: "auto",
            }}
          />
        </AlertDialogCancel>

        <div className="flex flex-col justify-start">
          <AlertDialogTitle
            className={`text-center text-[36px] leading-[48px] ${manjari.className}`}
          >
            Get push notifications
          </AlertDialogTitle>
          <AlertDialogDescription
            className={`text-center text-[18px] leading-[26px] text-dark ${poppins300.className} py-4`}
          >
            Would you like to receive push notifications when a proposal is
            about to close and you haven't cast your vote yet?
          </AlertDialogDescription>
        </div>

        <Button
          className={`mt-auto min-h-[60px] w-full bg-dark text-[32px] font-bold leading-[36px] disabled:bg-gold ${poppins700.className}`}
        >
          Yes!
        </Button>

        <Button
          className={`auto min-h-[60px] w-full bg-gold text-[32px] font-bold leading-[36px] disabled:bg-gold ${poppins700.className}`}
        >
          No
        </Button>
      </AlertDialogContent>
    </AlertDialog>
  );
};
