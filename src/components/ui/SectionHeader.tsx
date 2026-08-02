export function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pl-4 pt-6 pb-[7px] text-[13px] font-semibold text-(--color-ink-muted)">
      {children}
    </h2>
  );
}
