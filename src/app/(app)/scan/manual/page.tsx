import { ManualEntry } from "@/components/scan/ManualEntry";
import { NavBar } from "@/components/ui/NavBar";
import { BackLink } from "@/components/ui/BackLink";

export default function ManualEntryPage() {
  return (
    <>
      <NavBar title="Manual entry" left={<BackLink href="/scan" label="Scan" />} />
      <div className="flex flex-col gap-4 pt-6">
        <ManualEntry />
      </div>
    </>
  );
}
