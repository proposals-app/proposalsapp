import { getHotDaos } from "../actions";
import { Settings } from "./settings";

export default async function SettingsPage() {
  const hotDaos = await getHotDaos();

  return (
    <div className="flex w-full flex-col gap-8">
      <Settings hotDaos={hotDaos} />
    </div>
  );
}
