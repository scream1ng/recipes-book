import Link from "next/link";
import { ScanCapture } from "@/components/scan/ScanCapture";
import { NavBar } from "@/components/ui/NavBar";

export default function ScanPage() {
  return (
    <>
      <div className="-mx-4" style={{ marginTop: "calc(-1.5rem - env(safe-area-inset-top))" }}>
        <NavBar title="Scan a recipe" />
      </div>
      <ScanCapture />
      <p className="text-center text-sm text-(--color-ink-muted)">
        Prefer typing?{" "}
        <Link href="/scan/manual" className="text-(--color-accent) underline">
          Enter a recipe manually
        </Link>
      </p>
    </>
  );
}
