export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pl-4 pt-6 pb-[7px] text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">
      {children}
    </h2>
  );
}
