"use client";

import Image from "next/image";
import { updateBulletin, updateQuorum, updateTimeEnd } from "../actions";
import { useState } from "react";

export const Email = (props: {
  bulletinEnabled: boolean;
  quorumEnabled: boolean;
  timeEndEnabled: boolean;
}) => {
  return (
    <div className="flex max-w-[600px] flex-col gap-8 p-4">
      <DailyBulletin enabled={props.bulletinEnabled} />
      <TimeEnd enabled={props.timeEndEnabled} />
      <Quorum enabled={props.quorumEnabled} />
    </div>
  );
};

const DailyBulletin = (props: { enabled: boolean }) => {
  const [enabled, setEnabled] = useState(props.enabled);

  return (
    <div className="flex flex-row justify-between">
      <div className="flex flex-row gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-4">
            <Image
              src="/assets/icons/web/settings_email.svg"
              alt={""}
              width={24}
              height={24}
            />

            <div className="text-[18px] leading-[23px] text-white">
              Daily Bulletin
            </div>
          </div>
          <div className="max-w-[400px] text-[16px] leading-[23px] text-white">
            Receive a daily overview of all the future, present and past
            proposals.
          </div>
        </div>
      </div>

      <label
        className="relative inline-flex cursor-pointer items-center bg-gray-400 hover:bg-gray-500 h-6"
        data-testid="bulletin-enabled"
      >
        <input
          type="checkbox"
          checked={enabled}
          className="peer sr-only"
          onChange={async (e) => {
            setEnabled(e.target.checked);
            await updateBulletin(e.target.checked);
          }}
        />
        <div className="peer h-6 w-11 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5  after:bg-black after:transition-all after:content-[''] peer-checked:bg-[#5EF413] peer-checked:after:translate-x-full peer-checked:hover:bg-[#7EF642]" />
      </label>
    </div>
  );
};

const TimeEnd = (props: { enabled: boolean }) => {
  const [enabled, setEnabled] = useState(props.enabled);

  return (
    <div className="flex flex-row justify-between">
      <div className="flex flex-row gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-4">
            <Image
              src="/assets/icons/web/settings_email.svg"
              alt={""}
              width={24}
              height={24}
            />

            <div className="text-[18px] leading-[23px] text-white">
              Proposal ending
            </div>
          </div>
          <div className="max-w-[400px] text-[16px] leading-[23px] text-white">
            Receive a time sensitive reminder when a proposal is about to end
            and you did not vote yet.
          </div>
        </div>
      </div>
      <label
        className="relative inline-flex cursor-pointer items-center bg-gray-400 hover:bg-gray-500 h-6"
        data-testid="bulletin-enabled"
      >
        <input
          type="checkbox"
          checked={enabled}
          className="peer sr-only"
          onChange={async (e) => {
            setEnabled(e.target.checked);
            await updateTimeEnd(e.target.checked);
          }}
        />
        <div className="peer h-6 w-11 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5  after:bg-black after:transition-all after:content-[''] peer-checked:bg-[#5EF413] peer-checked:after:translate-x-full peer-checked:hover:bg-[#7EF642]" />
      </label>
    </div>
  );
};

const Quorum = (props: { enabled: boolean }) => {
  const [enabled, setEnabled] = useState(props.enabled);

  return (
    <div className="flex flex-row justify-between">
      <div className="flex flex-row gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-4">
            <Image
              src="/assets/icons/web/settings_email.svg"
              alt={""}
              width={24}
              height={24}
            />

            <div className="text-[18px] leading-[23px] text-white">
              Quorum alert
            </div>
          </div>
          <div className="max-w-[400px] text-[16px] leading-[23px] text-white">
            Receive a time sensitive reminder when a proposal is about to end,
            it did not reach quorum yet, and you did not vote.
          </div>
        </div>
      </div>
      <label
        className="relative inline-flex cursor-pointer items-center bg-gray-400 hover:bg-gray-500 h-6"
        data-testid="bulletin-enabled"
      >
        <input
          type="checkbox"
          checked={enabled}
          className="peer sr-only"
          onChange={async (e) => {
            setEnabled(e.target.checked);
            await updateQuorum(e.target.checked);
          }}
        />
        <div className="peer h-6 w-11 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5  after:bg-black after:transition-all after:content-[''] peer-checked:bg-[#5EF413] peer-checked:after:translate-x-full peer-checked:hover:bg-[#7EF642]" />
      </label>
    </div>
  );
};
