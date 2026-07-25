"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "uploading" | "error";

export function ScanCapture() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/scan/parse", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Scan failed");
      }

      sessionStorage.setItem("scan-review-draft", JSON.stringify(data));
      router.push("/scan/review");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Scan failed");
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div className="flex h-40 w-40 items-center justify-center rounded-full bg-(--color-surface-alt) text-5xl">
        📷
      </div>

      {status === "uploading" ? (
        <p className="text-(--color-ink-muted)">Reading your recipe…</p>
      ) : (
        <>
          <p className="max-w-xs text-(--color-ink-muted)">
            Take a photo of a recipe (handwritten or printed) and we&apos;ll pull out the
            ingredients for you.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white"
          >
            Take photo
          </button>
        </>
      )}

      {error && <p className="max-w-xs text-sm text-(--color-accent-dark)">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
