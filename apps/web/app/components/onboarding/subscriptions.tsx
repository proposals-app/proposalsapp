"use client";

import { Button } from "@/shadcn/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/shadcn/ui/dialog";
import { Manjari, Poppins } from "next/font/google";
import { hotDaosType, onboardingSubscribeDaos } from "@/app/actions";
import Image from "next/image";
import { useState } from "react";
import { CheckIcon } from "@radix-ui/react-icons";

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

  return (
    <Dialog open={open}>
      <DialogContent className="translate-y-[-90%] lg:translate-y-[-50%] bg-luna min-w-fit p-12 rounded-xl">
        <div className="flex flex-col justify-center">
          <DialogTitle
            className={`text-center text-4xl leading-[72px] ${manjari.className}`}
          >
            Subscribe to your favorite DAOs
          </DialogTitle>
          <DialogDescription
            className={`text-center leading-8 text-dark ${poppins300.className}`}
          >
            you can select all of them, or just one
          </DialogDescription>
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
            className={`w-full text-3xl disabled:bg-gold bg-dark ${poppins700.className}`}
            disabled={selectedDaos.length == 0}
            onClick={() => {
              onboardingSubscribeDaos(selectedDaos);
            }}
          >
            Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
