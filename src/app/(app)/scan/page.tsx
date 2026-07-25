import Link from "next/link";
import { ScanCapture } from "@/components/scan/ScanCapture";

export default function ScanPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-serif-heading text-3xl">Scan a recipe</h1>
      <ScanCapture />
      <p className="text-center text-sm text-(--color-ink-muted)">
        Prefer typing?{" "}
        <Link href="/scan/manual" className="text-(--color-accent) underline">
          Enter a recipe manually
        </Link>
      </p>
    </div>
  );
}
