export function NavBar({
  title,
  left,
  right,
}: {
  title?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header
      className="bg-(--color-bg)"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="relative flex h-[42px] items-center justify-between px-4 text-[15px]">
        <div className="min-w-[24px] text-(--color-accent)">{left}</div>
        {title && (
          <h1 className="pointer-events-none absolute inset-x-12 text-center text-[17px] font-semibold truncate">
            {title}
          </h1>
        )}
        <div className="min-w-[24px] text-right text-(--color-accent)">{right}</div>
      </div>
    </header>
  );
}
