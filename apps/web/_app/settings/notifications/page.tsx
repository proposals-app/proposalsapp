import { getUserSettings } from "./actions";
import { Email } from "./components/email-settings";

export default async function Home() {
  const settings = await getUserSettings();
  return (
    <div className="flex min-h-screen flex-col gap-10">
      <div className="flex flex-col gap-4">
        <div className="text-[24px] font-light leading-[30px] text-white">
          Notifications
        </div>

        <div className="max-w-[580px] text-[18px] text-white">
          Here&apos;s the place to pick and choose which notifications you want,
          and how you want them to reach you.
        </div>
      </div>

      <Email
        bulletinEnabled={settings?.bulletinEnabled}
        quorumEnabled={settings?.quorumEnabled}
        timeEndEnabled={settings?.timeEndEnabled}
      />
    </div>
  );
}
