export function Stepper({
  value,
  onIncrement,
  onDecrement,
  min = 0,
}: {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onDecrement}
        disabled={value <= min}
        aria-label="Decrease"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface-alt) text-(--color-ink) disabled:opacity-40"
      >
        −
      </button>
      <span className="w-4 text-center tabular-nums">{value}</span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label="Increase"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface-alt) text-(--color-ink)"
      >
        +
      </button>
    </div>
  );
}
