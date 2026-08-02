const STORE_STYLES: Record<string, { label: string; className: string }> = {
  COLES: { label: "Coles", className: "bg-(--color-coles)/15 text-(--color-coles)" },
  WOOLWORTHS: { label: "Woolies", className: "bg-(--color-woolies)/15 text-(--color-woolies)" },
};

export function StoreBadge({ store }: { store: string | null }) {
  const known = store ? STORE_STYLES[store] : null;
  const label = known?.label ?? "Yours";
  const className = known?.className ?? "bg-(--color-surface-alt) text-(--color-ink-muted)";

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}
