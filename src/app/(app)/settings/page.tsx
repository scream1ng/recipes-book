import { getSettings } from "@/lib/actions/settings";
import { signOut } from "@/lib/auth";
import { SettingsForm } from "@/components/SettingsForm";
import { NavBar } from "@/components/ui/NavBar";
import { ListGroup, ListRow } from "@/components/ui/ListGroup";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default async function SettingsPage() {
  const settings = await getSettings();

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/signin" });
  }

  return (
    <>
      <NavBar title="Settings" />

      <SettingsForm settings={settings} />

      <SectionHeader>Account</SectionHeader>
      <ListGroup>
        <form action={handleSignOut}>
          <ListRow interactive>
            <button
              type="submit"
              className="w-full text-center font-medium text-(--color-destructive)"
            >
              Sign out
            </button>
          </ListRow>
        </form>
      </ListGroup>
    </>
  );
}
