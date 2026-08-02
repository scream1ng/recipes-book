export function Spinner({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      className={`motion-safe:animate-spin text-(--color-accent) ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="42 100"
      />
    </svg>
  );
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Spinner size={28} />
    </div>
  );
}
