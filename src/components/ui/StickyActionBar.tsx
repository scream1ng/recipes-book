export function StickyActionBar({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-20" />
      <div
        className="fixed inset-x-0 z-10 border-t border-t-[rgba(60,40,35,0.22)] bg-(--color-surface)/95 backdrop-blur"
        style={{ bottom: "var(--tabbar-total)" }}
      >
        <div className="mx-auto flex max-w-lg gap-2 px-4 py-3">{children}</div>
      </div>
    </>
  );
}
