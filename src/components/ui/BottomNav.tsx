"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/recipes", label: "Recipes", icon: "recipes" },
  { href: "/scan", label: "Scan", icon: "scan" },
  { href: "/list", label: "List", icon: "list" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 h-16 border-t border-(--color-border) bg-(--color-surface)/95 backdrop-blur">
      <ul className="mx-auto flex h-full max-w-lg items-center justify-around">
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-xs ${
                  active ? "text-(--color-accent)" : "text-(--color-ink-muted)"
                }`}
              >
                <Icon name={tab.icon} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
