"use client";

import { useTransition } from "react";
import { updateSettings } from "@/lib/actions/settings";
import { ListGroup, ListRow, ListDivider } from "@/components/ui/ListGroup";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Toggle } from "@/components/ui/Toggle";
import { Icon } from "@/components/ui/Icon";

interface Settings {
  storePreference: "COLES" | "WOOLWORTHS" | "CHEAPEST_OF_BOTH";
  showUnitPrices: boolean;
  warnStalePrices: boolean;
  stalePriceHours: number;
  roundUpPartPacks: boolean;
  keepOffline: boolean;
}

const STORE_OPTIONS: Array<{ value: Settings["storePreference"]; label: string }> = [
  { value: "COLES", label: "Coles" },
  { value: "WOOLWORTHS", label: "Woolworths" },
  { value: "CHEAPEST_OF_BOTH", label: "Cheapest of both" },
];

export function SettingsForm({ settings }: { settings: Settings }) {
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    startTransition(() => {
      void updateSettings({ [key]: value });
    });
  }

  return (
    <>
      <SectionHeader>Store preference</SectionHeader>
      <ListGroup>
        {STORE_OPTIONS.map((opt, i) => (
          <div key={opt.value}>
            {i > 0 && <ListDivider />}
            <ListRow interactive>
              <button
                type="button"
                disabled={isPending}
                onClick={() => set("storePreference", opt.value)}
                className="flex min-h-11 flex-1 items-center justify-between text-left"
              >
                {opt.label}
                {settings.storePreference === opt.value && (
                  <Icon name="checkmark" size={18} className="text-(--color-accent)" />
                )}
              </button>
            </ListRow>
          </div>
        ))}
      </ListGroup>

      <SectionHeader>Pricing</SectionHeader>
      <ListGroup>
        <ListRow>
          <span className="flex-1">Show unit prices</span>
          <Toggle
            checked={settings.showUnitPrices}
            disabled={isPending}
            onChange={(v) => set("showUnitPrices", v)}
            label="Show unit prices"
          />
        </ListRow>
        <ListDivider />
        <ListRow>
          <span className="flex-1">Warn on stale prices</span>
          <Toggle
            checked={settings.warnStalePrices}
            disabled={isPending}
            onChange={(v) => set("warnStalePrices", v)}
            label="Warn on stale prices"
          />
        </ListRow>
        {settings.warnStalePrices && (
          <>
            <ListDivider />
            <ListRow>
              <span className="flex-1 text-sm">Stale after (hours)</span>
              <input
                type="number"
                min={1}
                defaultValue={settings.stalePriceHours}
                disabled={isPending}
                onBlur={(e) =>
                  set("stalePriceHours", Number(e.target.value) || settings.stalePriceHours)
                }
                className="w-20 rounded-lg border border-(--color-border) px-2 py-1 text-base"
              />
            </ListRow>
          </>
        )}
        <ListDivider />
        <ListRow>
          <span className="flex-1">Round up part packs on shopping list</span>
          <Toggle
            checked={settings.roundUpPartPacks}
            disabled={isPending}
            onChange={(v) => set("roundUpPartPacks", v)}
            label="Round up part packs on shopping list"
          />
        </ListRow>
        <ListDivider />
        <ListRow>
          <span className="flex-1 text-(--color-ink-muted)">Keep offline (coming later)</span>
          <Toggle checked={settings.keepOffline} disabled onChange={() => {}} label="Keep offline" />
        </ListRow>
      </ListGroup>
    </>
  );
}
