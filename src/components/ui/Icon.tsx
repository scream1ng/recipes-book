const PATHS = {
  order:
    "M7 8V6.5a5 5 0 0110 0V8M4.5 8h15l-1 11.5a2 2 0 01-2 1.8h-9a2 2 0 01-2-1.8L4.5 8z",
  recipes:
    "M5 4.5h11a2.5 2.5 0 012.5 2.5v12.5H7.5A2.5 2.5 0 015 17V4.5zM8.5 8.5h7M8.5 12h5",
  scan: "M4 8.5A2.5 2.5 0 016.5 6H8l1.2-2h5.6L16 6h1.5A2.5 2.5 0 0120 8.5v8A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5zM12 9.2a3.3 3.3 0 100 6.6 3.3 3.3 0 000-6.6z",
  list: "M4 6.5h3M4 12h3M4 17.5h3M10 6.5h10M10 12h10M10 17.5h10",
  pantry: "M5 9.5h14M5 9.5V19h14V9.5M5 9.5l1.5-4.5h11L19 9.5M10 13h4",
  settings:
    "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM12 3.5v2M12 18.5v2M4.9 7.6l1.7 1M17.4 15.4l1.7 1M4.9 16.4l1.7-1M17.4 8.6l1.7-1",
  "chevron-left": "M15 5l-7 7 7 7",
  "chevron-right": "M9 5l7 7-7 7",
  xmark: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  checkmark: "M5 12.5l4.5 4.5L19 7",
} as const;

const FILLED_PATHS = {
  order:
    "M7 8V6.5a5 5 0 0110 0V8h1.5A2.5 2.5 0 0121 10.5v6A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5v-6A2.5 2.5 0 015.5 8H7zm2 0h6V6.5a3 3 0 00-6 0V8z",
  recipes:
    "M5 4.5h11a2.5 2.5 0 012.5 2.5v12.5H7.5A2.5 2.5 0 015 17V4.5zM9 8.5a.75.75 0 000 1.5h6a.75.75 0 000-1.5H9zm0 3.5a.75.75 0 000 1.5h5a.75.75 0 000-1.5H9z",
  pantry: "M5 9.5h14L19 19H5zM5 9.5l1.5-4.5h11L19 9.5",
} as const;

export type IconName = keyof typeof PATHS;
type FillableIconName = keyof typeof FILLED_PATHS;

export function Icon({
  name,
  size = 22,
  filled = false,
  className,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
  className?: string;
}) {
  const isFillable = filled && name in FILLED_PATHS;

  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFillable ? "currentColor" : "none"}
      stroke={isFillable ? "none" : "currentColor"}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={isFillable ? FILLED_PATHS[name as FillableIconName] : PATHS[name]} />
    </svg>
  );
}
