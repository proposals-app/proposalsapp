"use client";

import { Button } from "@/shadcn/ui/button";
import { hotDaosType } from "../actions";
import { EmailSettings } from "./components/email";
import { SubscriptionsSettings } from "./components/subscriptions";
import { VoterSeettings } from "./components/voter";
import Link from "next/link";
import { Manjari } from "next/font/google";
import { SignOutButton } from "./components/sign-out";
import { BackButton } from "./components/back-button";
import { SaveButton } from "./components/save-button";

export const Settings = ({ hotDaos }: { hotDaos: hotDaosType }) => {
  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex w-full justify-between">
        <BackButton />
        <SaveButton />
      </div>
      <p className="text-[36px] font-bold leading-[48px]">
        your account settings
      </p>

      <EmailSettings />
      <SubscriptionsSettings hotDaos={hotDaos} />
      <VoterSeettings />
      <SignOutButton />
    </div>
  );
};
