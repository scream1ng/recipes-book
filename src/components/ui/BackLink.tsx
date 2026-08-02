import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

/** iOS-style back control: chevron + previous screen's title, 44pt min tap target. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ml-2 flex h-11 items-center gap-0.5 pl-2 pr-3 active:opacity-60"
    >
      <Icon name="chevron-left" size={20} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
