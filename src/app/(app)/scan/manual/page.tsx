import { ManualEntry } from "@/components/scan/ManualEntry";

export default function ManualEntryPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl">Manual entry</h1>
      <ManualEntry />
    </div>
  );
}
