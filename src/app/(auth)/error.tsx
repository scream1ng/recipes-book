"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-(--color-ink-muted)">Something went wrong.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-(--color-accent) px-6 py-2.5 text-sm font-medium text-white active:opacity-70"
      >
        Try again
      </button>
    </div>
  );
}
