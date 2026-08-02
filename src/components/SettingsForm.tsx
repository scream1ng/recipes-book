"use client";

import { useTransition } from "react";
import { updateSettings } from "@/lib/actions/settings";

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
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-lg">Store preference</h2>
        <div className="flex flex-col gap-2">
          {STORE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 rounded-xl border border-(--color-border) bg-(--color-surface) p-3"
            >
              <input
                type="radio"
                name="storePreference"
                checked={settings.storePreference === opt.value}
                disabled={isPending}
                onChange={() => set("storePreference", opt.value)}
                className="accent-(--color-accent)"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Toggle
          label="Show unit prices"
          checked={settings.showUnitPrices}
          disabled={isPending}
          onChange={(v) => set("showUnitPrices", v)}
        />
        <Toggle
          label="Warn on stale prices"
          checked={settings.warnStalePrices}
          disabled={isPending}
          onChange={(v) => set("warnStalePrices", v)}
        />
        {settings.warnStalePrices && (
          <label className="flex items-center justify-between rounded-xl border border-(--color-border) bg-(--color-surface) p-3 text-sm">
            Stale after (hours)
            <input
              type="number"
              min={1}
              defaultValue={settings.stalePriceHours}
              disabled={isPending}
              onBlur={(e) => set("stalePriceHours", Number(e.target.value) || settings.stalePriceHours)}
              className="w-20 rounded-lg border border-(--color-border) px-2 py-1"
            />
          </label>
        )}
        <Toggle
          label="Round up part packs on shopping list"
          checked={settings.roundUpPartPacks}
          disabled={isPending}
          onChange={(v) => set("roundUpPartPacks", v)}
        />
        <Toggle
          label="Keep offline (coming later)"
          checked={settings.keepOffline}
          disabled
          onChange={(v) => set("keepOffline", v)}
        />
      </section>
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-(--color-border) bg-(--color-surface) p-3 text-sm">
      {label}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-(--color-accent)"
      />
    </label>
  );
}
