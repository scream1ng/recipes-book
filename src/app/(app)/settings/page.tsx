import Link from "next/link";
import { getSettings } from "@/lib/actions/settings";
import { SettingsForm } from "@/components/SettingsForm";
import { NavBar } from "@/components/ui/NavBar";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <div className="-mx-4" style={{ marginTop: "calc(-1.5rem - env(safe-area-inset-top))" }}>
        <NavBar title="Settings" left={<Link href="/pantry">←</Link>} />
      </div>
      <div className="flex flex-col gap-4 px-4">
        <SettingsForm settings={settings} />
      </div>
    </>
  );
}
