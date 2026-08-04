"use client";

export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-x-4 z-30 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl bg-(--color-ink)/95 px-4 py-3 text-sm text-white shadow-lg motion-safe:animate-[toast-in_0.2s_ease-out]"
      style={{ bottom: "calc(var(--tabbar-total) + 12px)" }}
      role="status"
    >
      <span className="min-w-0 flex-1 truncate">{message}</span>
      <div className="flex shrink-0 items-center gap-3">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="font-medium text-(--color-accent-soft)"
          >
            {actionLabel}
          </button>
        )}
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-white/70">
          ✕
        </button>
      </div>
    </div>
  );
}
