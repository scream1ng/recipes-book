const PATHS = {
  recipes:
    "M5 4.5h11a2.5 2.5 0 012.5 2.5v12.5H7.5A2.5 2.5 0 015 17V4.5zM8.5 8.5h7M8.5 12h5",
  scan: "M4 8.5A2.5 2.5 0 016.5 6H8l1.2-2h5.6L16 6h1.5A2.5 2.5 0 0120 8.5v8A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5zM12 9.2a3.3 3.3 0 100 6.6 3.3 3.3 0 000-6.6z",
  list: "M4 6.5h3M4 12h3M4 17.5h3M10 6.5h10M10 12h10M10 17.5h10",
  settings:
    "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM12 3.5v2M12 18.5v2M4.9 7.6l1.7 1M17.4 15.4l1.7 1M4.9 16.4l1.7-1M17.4 8.6l1.7-1",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 22,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
