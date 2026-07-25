"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/recipes", label: "Recipes", icon: "\u{1F4D6}" },
  { href: "/scan", label: "Scan", icon: "\u{1F4F7}" },
  { href: "/list", label: "List", icon: "\u{1F6D2}" },
  { href: "/settings", label: "Settings", icon: "\u{2699}\u{FE0F}" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-10 border-t border-(--color-border) bg-(--color-surface)/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg justify-around py-2">
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
                <span aria-hidden className="text-lg leading-none">
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
