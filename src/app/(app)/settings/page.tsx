import { getSettings } from "@/lib/actions/settings";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif-heading text-3xl">Settings</h1>
      <SettingsForm settings={settings} />
    </div>
  );
}
