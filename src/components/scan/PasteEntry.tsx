"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { StickyActionBar } from "@/components/ui/StickyActionBar";

const MAX_CHARS = 50_000;
const COUNTER_THRESHOLD = 45_000;

export function PasteEntry() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "reading">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.length > MAX_CHARS) {
      setError("That's a lot of text. Trim it down to just the recipe and try again.");
      return;
    }
    if (/^https?:\/\/\S+$/i.test(trimmed)) {
      setError("Paste the recipe text itself — we can't open links yet.");
      return;
    }

    setStatus("reading");
    setError(null);

    try {
      const res = await fetch("/api/scan/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that. Try again.");

      if ((data.lines?.length ?? 0) === 0 && (data.method?.length ?? 0) === 0) {
        setStatus("idle");
        setError("We couldn't find a recipe in that. Try pasting just the ingredients and method.");
        return;
      }

      sessionStorage.setItem("scan-review-draft", JSON.stringify({ ...data, source: "paste" }));
      router.push("/scan/review");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Couldn't read that. Try again.");
    }
  }

  if (status === "reading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-(--color-surface-alt)">
          <Icon name="list" size={48} className="text-(--color-accent) motion-safe:animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-(--color-ink-muted)">Reading your recipe…</p>
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <>
      <p className="pt-6 text-(--color-ink-muted)">
        Copy a recipe from a website, or type out your own notes. Ingredients, method, or both —
        we&apos;ll sort it into the right places.
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        placeholder="Paste or type the recipe here…"
        autoFocus
        className="mt-4 min-h-[45vh] w-full resize-y rounded-xl bg-(--color-surface) p-4 text-[15px] leading-relaxed outline-none placeholder:text-(--color-ink-muted)"
      />

      {text.length > COUNTER_THRESHOLD && (
        <p className="pt-2 text-right text-xs tabular-nums text-(--color-ink-muted)">
          {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
        </p>
      )}

      {error && <p className="pt-2 text-sm text-(--color-accent-dark)">{error}</p>}

      <StickyActionBar>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={handleSubmit}
          className="flex-1 rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white disabled:opacity-40"
        >
          Read recipe
        </button>
      </StickyActionBar>
    </>
  );
}
