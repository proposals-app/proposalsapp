import { validateRequest } from "@/lib/auth";
import { getHotDaos } from "../actions";
import { getCurrentSettings } from "./actions";
import { Settings } from "./settings";

import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const currentSettings = await getCurrentSettings();
  const hotDaos = await getHotDaos();
  let { user } = await validateRequest();

  if (!user) redirect("/");

  return (
    <div className="flex w-full flex-col gap-8">
      <Settings hotDaos={hotDaos} currentSettings={currentSettings} />
    </div>
  );
}
