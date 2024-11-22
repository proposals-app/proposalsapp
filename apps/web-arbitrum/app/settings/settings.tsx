"use client";

import { useState, useEffect } from "react";
import { hotDaosType } from "../actions";
import { EmailSettings } from "./components/email";
import { SubscriptionsSettings } from "./components/subscriptions";
import { VoterSettings } from "./components/voter";
import { SignOutButton } from "./components/sign-out";
import { BackButton } from "./components/back-button";
import { SaveButton } from "./components/save-button";
import { currentSettingsType, saveSettings } from "./actions";
import { PushNotificationsModal } from "./components/push-notifications-modal";

export const Settings = ({
  hotDaos,
  currentSettings,
}: {
  hotDaos: hotDaosType;
  currentSettings: currentSettingsType;
}) => {
  const [saveButtonEnabled, setSaveButtonEnabled] = useState(false);
  const [email, setEmail] = useState(currentSettings.email);
  const [daoSlugs, setDaoSlugs] = useState(currentSettings.daoSlugs);
  const [voterAddress, setVoterAddress] = useState(
    currentSettings.voterAddress,
  );

  const [isEmailValid, setEmailValid] = useState(true);
  const [isVoterAddressValid, setVoterAddressValid] = useState(true);

  const handleSave = async () => {
    try {
      await saveSettings({ email, daoSlugs, voterAddress }).then(() => {
        setSaveButtonEnabled(false);
      });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    setSaveButtonEnabled(isEmailValid && isVoterAddressValid);
  }, [isEmailValid, isVoterAddressValid]);

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="flex w-full justify-between">
        <BackButton />
        <SaveButton disabled={!saveButtonEnabled} onClick={handleSave} />
      </div>
      <p className="text-[36px] font-bold leading-[48px]">
        your account settings
      </p>

      <EmailSettings
        currentEmail={email}
        setEmail={setEmail}
        setEmailValid={setEmailValid}
      />
      <SubscriptionsSettings
        hotDaos={hotDaos}
        currentSubscriptions={daoSlugs}
        setSelectedDaos={setDaoSlugs}
      />
      <VoterSettings
        currentVoterAddress={voterAddress}
        setVoterAddress={setVoterAddress}
        setVoterAddressValid={setVoterAddressValid}
      />
      <PushNotificationsModal />
      <SignOutButton />
    </div>
  );
};
