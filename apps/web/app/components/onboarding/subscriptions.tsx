"use client";

import { Button } from "@/shadcn/ui/button";
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
import { cn } from "@/lib/utils";
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
          `bg-luna w-full lg:max-w-[40%] px-16 py-12 rounded-3xl sm:rounded-3xl`,
        )}
      >
        <AlertDialogCancel
          asChild
          onClick={() => {
            signOut().then(() => router.refresh());
          }}
        >
          <Image
            className="absolute m-2 w-8 h-8 sm:w-12 sm:h-12"
            src="/assets/icons/web/new/close-button.svg"
            alt="close button"
            width={48}
            height={48}
          />
        </AlertDialogCancel>
        <div className="flex flex-col justify-center">
          <AlertDialogTitle
            className={`text-center text-4xl ${manjari.className}`}
          >
            Follow your favorite DAOs
          </AlertDialogTitle>
          <AlertDialogDescription
            className={`text-center text-lg text-dark ${poppins300.className}`}
          >
            you can select all of them, or just one
          </AlertDialogDescription>
        </div>

        <div className="grid grid-cols-6 grid-flow-row gap-4">
          {hotDaos.map((dao) => (
            <div
              className="min-w-20 min-h-20 relative"
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
                <CheckIcon className="w-8 h-8 bg-green-500 text-white rounded-full absolute -top-2 -right-2" />
              )}
              <Image
                className={`${selectedDaos.includes(dao.slug) ? "bg-dark" : "bg-luna border-2 border-gold"} rounded`}
                height={80}
                width={80}
                alt={dao.name}
                src={
                  selectedDaos.includes(dao.slug)
                    ? `/assets/project-logos/hot/${dao.slug}_active.svg`
                    : `/assets/project-logos/hot/${dao.slug}_inactive.svg`
                }
              />
            </div>
          ))}
        </div>

        <div className="pt-8">
          <Button
            className={`w-full p-6 text-3xl disabled:bg-gold bg-dark ${poppins700.className}`}
            disabled={selectedDaos.length == 0}
            onClick={() => {
              onboardingSubscribeDaos(selectedDaos);
            }}
          >
            Continue...
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};
