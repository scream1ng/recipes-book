export function ListGroup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-xl bg-(--color-surface) ${className}`}>
      {children}
    </div>
  );
}

export function ListRow({
  children,
  className = "",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`flex min-h-[48px] items-center gap-3 px-4 py-2 ${
        interactive ? "active:bg-(--color-surface-alt)" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Hairline divider, inset from the left edge (16px, or 76px past a leading avatar). */
export function ListDivider({ inset = 16 }: { inset?: number }) {
  return (
    <div
      style={{
        height: ".5px",
        marginLeft: inset,
        background: "rgba(60, 40, 35, .11)",
      }}
    />
  );
}
