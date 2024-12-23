"use client";

import { Button, buttonVariants } from "@/shadcn/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/shadcn/ui/alert-dialog";
import { Manjari, Poppins } from "next/font/google";
import Image from "next/image";
import { useState } from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import { onboardingSubscribeDaos } from "./actions";
import { hotDaosType } from "@/app/actions";
import { cn } from "@/shadcn/lib/utils";
import { useRouter } from "next/navigation";

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

export const OnboardingSubscriptionModal = ({
  open,
  hotDaos,
}: {
  open: boolean;
  hotDaos: hotDaosType;
}) => {
  const [selectedDaos, setSelectedDaos] = useState([
    ...hotDaos.map((d) => d.slug),
  ]);

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
    <AlertDialog open={open}>
      <AlertDialogContent
        className={cn(
          `flex h-screen w-full flex-col items-center bg-luna px-4 pt-32 lg:h-fit lg:max-h-[70vh] lg:min-h-[400px] lg:max-w-2xl lg:rounded-3xl lg:p-12`,
        )}
      >
        <AlertDialogCancel
          asChild
          className={cn(
            buttonVariants({ variant: "default" }),
            "m-0 rounded-full bg-transparent p-0 hover:bg-transparent",
          )}
        >
          <Image
            className="absolute left-4 top-12 h-[48px] w-[48px] cursor-pointer lg:left-2 lg:top-2"
            src="/assets/icons/web/new/close-button.svg"
            alt="close button"
            width={48}
            height={48}
            onClick={() => {
              signOut().then(() => router.refresh());
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
            Follow your favorite DAOs
          </AlertDialogTitle>
          <AlertDialogDescription
            className={`text-center text-[18px] leading-[26px] text-dark ${poppins300.className}`}
          >
            you can select all of them, or just one
          </AlertDialogDescription>
        </div>

        <div className="grid h-fit w-fit grid-flow-row grid-cols-4 gap-4 justify-self-center py-8 lg:grid-cols-6">
          {hotDaos.map((dao) => (
            <div
              className="relative h-[80px] w-[80px]"
              key={dao.id}
              onClick={() => {
                if (selectedDaos.includes(dao.slug)) {
                  let filtered = selectedDaos.filter((d) => d != dao.slug);
                  setSelectedDaos([...filtered]);
                } else {
                  setSelectedDaos([...selectedDaos, dao.slug]);
                }
              }}
            >
              {selectedDaos.includes(dao.slug) && (
                <CheckIcon className="absolute -right-[8px] -top-[8px] h-[32px] w-[32px] rounded-full bg-green-500 text-white" />
              )}
              <Image
                className={`${selectedDaos.includes(dao.slug) ? "bg-dark" : "border-2 border-gold bg-luna"} rounded`}
                height={80}
                width={80}
                alt={dao.name}
                src={
                  selectedDaos.includes(dao.slug)
                    ? `/assets/project-logos/hot/${dao.slug}_active.svg`
                    : `/assets/project-logos/hot/${dao.slug}_inactive.svg`
                }
                style={{
                  maxWidth: "100%",
                  height: "auto",
                }}
              />
            </div>
          ))}
        </div>

        <Button
          className={`mb-20 mt-auto min-h-[60px] w-full bg-dark text-[32px] font-bold leading-[36px] disabled:bg-gold lg:mb-0 ${poppins700.className}`}
          disabled={selectedDaos.length == 0}
          onClick={() => {
            onboardingSubscribeDaos(selectedDaos);
          }}
        >
          Continue...
        </Button>
      </AlertDialogContent>
    </AlertDialog>
  );
};
