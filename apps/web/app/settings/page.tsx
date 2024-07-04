import { getHotDaos } from "../actions";
import { getCurrentSettings } from "./actions";
import { Settings } from "./settings";

export default async function SettingsPage() {
  const currentSettings = await getCurrentSettings();
  const hotDaos = await getHotDaos();

  return (
    <div className="flex w-full flex-col gap-8">
      <Settings hotDaos={hotDaos} currentSettings={currentSettings} />
    </div>
  );
}
