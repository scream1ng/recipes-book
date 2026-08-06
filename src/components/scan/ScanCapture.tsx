"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";

type Status = "idle" | "uploading" | "error";

const MAX_PHOTOS = 6;

interface Photo {
  file: File;
  url: string;
}

export function ScanCapture() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const photosRef = useRef(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.url);
    };
  }, []);

  function addPhoto(file: File) {
    setPhotos((prev) =>
      prev.length >= MAX_PHOTOS ? prev : [...prev, { file, url: URL.createObjectURL(file) }]
    );
    setError(null);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit() {
    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    for (const photo of photos) formData.append("images", photo.file);

    try {
      const res = await fetch("/api/scan/parse", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Scan failed");
      }

      sessionStorage.setItem("scan-review-draft", JSON.stringify({ ...data, source: "photo" }));
      router.push("/scan/review");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Scan failed");
    }
  }

  if (status === "uploading") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-(--color-surface-alt) text-5xl">
          <Icon
            name="scan"
            size={48}
            className="text-(--color-accent) motion-safe:animate-pulse"
          />
        </div>
        <p className="text-sm font-semibold text-(--color-ink-muted)">Reading your recipe…</p>
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-(--color-surface-alt) text-5xl">
          <Icon name="scan" size={48} className="text-(--color-accent)" />
        </div>

        <p className="max-w-xs text-(--color-ink-muted)">
          Take photos of a recipe (handwritten or printed) — ingredients, method, or both — and
          we&apos;ll pull out the details for you.
        </p>

        {photos.length > 0 && (
          <div className="flex w-full max-w-xs flex-wrap justify-center gap-2">
            {photos.map((photo, i) => (
              <div key={photo.url} className="relative h-16 w-16 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not a remote asset next/image can optimize */}
                <img
                  src={photo.url}
                  alt={`Recipe photo ${i + 1}`}
                  className="h-full w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center active:opacity-60"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-(--color-ink)/80 text-white">
                    <Icon name="xmark" size={11} />
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-4 pb-2">
        {photos.length < MAX_PHOTOS && (
          <div className="flex items-center gap-3">
            <label className="relative rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white">
              {photos.length === 0 ? "Take photo" : "Add another photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addPhoto(file);
                  e.target.value = "";
                }}
              />
            </label>
            <label className="relative rounded-full border border-(--color-border) px-6 py-3 font-medium text-(--color-ink)">
              Choose from gallery
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addPhoto(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        )}

        {photos.length > 0 && (
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-full border border-(--color-border) px-6 py-3 font-medium text-(--color-ink)"
          >
            Read recipe ({photos.length} {photos.length === 1 ? "photo" : "photos"})
          </button>
        )}

        {error && <p className="max-w-xs text-sm text-(--color-accent-dark)">{error}</p>}

        <p className="text-sm text-(--color-ink-muted)">
          Got it as text?{" "}
          <Link href="/scan/paste" className="text-(--color-accent) underline">
            Paste it instead
          </Link>
        </p>
      </div>
    </div>
  );
}
