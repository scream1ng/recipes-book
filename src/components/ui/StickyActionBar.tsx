export function StickyActionBar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-20" />
      <div className="fixed inset-x-0 bottom-16 z-10 border-t border-(--color-border) bg-(--color-surface)/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2 px-4 py-3">{children}</div>
      </div>
    </>
  );
}
