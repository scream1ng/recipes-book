import { ScanCapture } from "@/components/scan/ScanCapture";
import { NavBar } from "@/components/ui/NavBar";

export default function ScanPage() {
  return (
    <div
      className="flex flex-col"
      style={{
        minHeight:
          "calc(100dvh - 1.5rem - env(safe-area-inset-top) - 1rem - var(--tabbar-total))",
      }}
    >
      <NavBar title="Scan a recipe" />
      <ScanCapture />
    </div>
  );
}
