"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getPriceRunTargets, runPriceItem } from "@/lib/actions/catalog";
import { NavBar } from "@/components/ui/NavBar";
import { Spinner } from "@/components/ui/Spinner";
import { Toast } from "@/components/ui/Toast";

const ITEM_DELAY_MS = 750;
const CONSECUTIVE_EMPTY_LIMIT = 5;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One "Update prices" run over the Ingredients screen: discovers a Coles price for
 * every unpriced ingredient (best-match auto-pick, no per-row taps) and refreshes
 * stale/errored Coles prices — see selectPriceRunTargets/pickRecommendedColesProduct.
 * Renders the NavBar itself so the action button and progress strip share one state.
 */
export function PriceRunBar({ title, eligibleCount }: { title: string; eligibleCount: number }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ index: number; total: number; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  async function start() {
    if (running) return;
    setRunning(true);
    cancelledRef.current = false;

    let targets;
    try {
      targets = await getPriceRunTargets();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Couldn't start update");
      setRunning(false);
      return;
    }

    if (targets.length === 0) {
      setToast("Nothing to update");
      setRunning(false);
      return;
    }

    let discovered = 0;
    let updated = 0;
    let missed = 0;
    let consecutiveEmpty = 0;
    let stoppedReason: string | null = null;

    for (let i = 0; i < targets.length; i++) {
      if (cancelledRef.current) break;
      setProgress({ index: i + 1, total: targets.length, name: targets[i].name });

      const result = await runPriceItem(targets[i]);
      if (result.ok) {
        if (result.kind === "discover") discovered++;
        else updated++;
        consecutiveEmpty = 0;
      } else {
        missed++;
        // Only a real Coles/scraper failure counts toward the outage abort — a
        // legitimate "no confident match" for an odd ingredient name isn't a sign
        // anything's broken, and shouldn't stop the run from reaching the rest of
        // the queue.
        if (result.apiFailure) consecutiveEmpty++;
        else consecutiveEmpty = 0;
      }

      if (consecutiveEmpty >= CONSECUTIVE_EMPTY_LIMIT) {
        stoppedReason = "Coles isn't responding — try again later";
        break;
      }

      // Cached lookups made no network call — no need to rate-limit-friendly pace them.
      if (i < targets.length - 1 && !result.cached) await delay(ITEM_DELAY_MS);
    }

    setProgress(null);
    setRunning(false);
    router.refresh();

    const parts: string[] = [];
    if (discovered > 0) parts.push(`Priced ${discovered}`);
    if (updated > 0) parts.push(`Updated ${updated}`);
    if (missed > 0) parts.push(`${missed} not found`);
    setToast(stoppedReason ?? (parts.length > 0 ? parts.join(" · ") : "No prices updated"));
  }

  function stop() {
    cancelledRef.current = true;
  }

  return (
    <>
      <NavBar
        title={title}
        right={
          running ? (
            <button type="button" onClick={stop} className="inline-flex min-h-11 items-center text-sm font-medium">
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={eligibleCount === 0}
              className="inline-flex min-h-11 items-center text-sm font-medium disabled:text-(--color-ink-muted)"
            >
              Update prices{eligibleCount > 0 ? ` (${eligibleCount})` : ""}
            </button>
          )
        }
      />
      {running && progress && (
        <div className="flex items-center gap-3 px-4 pb-1 text-sm text-(--color-ink-muted)">
          <Spinner size={16} />
          <span className="min-w-0 flex-1 truncate">
            Getting prices {progress.index} of {progress.total} · {progress.name}
          </span>
        </div>
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
