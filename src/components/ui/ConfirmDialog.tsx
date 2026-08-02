"use client";

import { useEffect, useState } from "react";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  isPending = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function handleCancel() {
    setClosing(true);
    setTimeout(onCancel, 150);
  }

  return (
    <div
      className={`fixed inset-0 z-30 flex items-end justify-center bg-black/40 transition-opacity duration-150 ${
        closing ? "opacity-0" : "motion-safe:animate-[fade-in_.15s_ease-out]"
      }`}
      onClick={handleCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full max-w-lg px-4 pb-4 transition-transform duration-150 ${
          closing ? "translate-y-full" : "motion-safe:animate-[sheet-up_.2s_ease-out]"
        }`}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-2xl bg-(--color-surface)/95 text-center backdrop-blur">
          <div className="px-5 py-4">
            <p className="text-[15px] font-semibold text-(--color-ink)">{title}</p>
            {message && <p className="mt-1 text-[13px] text-(--color-ink-muted)">{message}</p>}
          </div>
          <div className="border-t border-(--color-border)">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isPending}
              className="flex h-12 w-full items-center justify-center font-medium text-(--color-destructive) active:bg-(--color-surface-alt) disabled:opacity-50"
            >
              {isPending ? "Deleting…" : confirmLabel}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCancel}
          className="mt-2 h-12 w-full rounded-2xl bg-(--color-surface)/95 font-semibold backdrop-blur active:bg-(--color-surface-alt)"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
