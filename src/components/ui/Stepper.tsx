import { Icon } from "@/components/ui/Icon";

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
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onDecrement}
        disabled={value <= min}
        aria-label="Decrease"
        className="flex h-11 w-11 items-center justify-center rounded-full text-(--color-ink) active:bg-(--color-surface-alt) disabled:opacity-40"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface-alt)">
          <Icon name="minus" size={14} />
        </span>
      </button>
      <span className="w-4 text-center tabular-nums">{value}</span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label="Increase"
        className="flex h-11 w-11 items-center justify-center rounded-full text-(--color-ink) active:bg-(--color-surface-alt)"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface-alt)">
          <Icon name="plus" size={14} />
        </span>
      </button>
    </div>
  );
}
