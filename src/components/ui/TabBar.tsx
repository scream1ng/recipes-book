"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/order", label: "Order", icon: "order" },
  { href: "/recipes", label: "Recipes", icon: "recipes" },
  { href: "/pantry", label: "Ingredients", icon: "pantry" },
];

/** /list groups under Ingredients, /scan and recipe detail group under Recipes — matches the source design's tab grouping. */
function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/pantry") return pathname.startsWith("/pantry") || pathname.startsWith("/list");
  if (href === "/recipes") return pathname.startsWith("/recipes") || pathname.startsWith("/scan");
  return pathname.startsWith(href);
}

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-(--color-border) bg-(--color-surface)/90 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul
        className="mx-auto flex max-w-lg items-center justify-around"
        style={{ height: "var(--tabbar-h)" }}
      >
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 px-4 text-[11px] active:opacity-60 ${
                  active ? "text-(--color-accent)" : "text-(--color-ink-muted)"
                }`}
              >
                <Icon name={tab.icon} size={22} filled={active} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
