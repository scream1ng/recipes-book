"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBulkRefreshTargets, bulkRefreshItem } from "@/lib/actions/catalog";
import { Spinner } from "@/components/ui/Spinner";
import { Toast } from "@/components/ui/Toast";

const ITEM_DELAY_MS = 750;
const CONSECUTIVE_EMPTY_LIMIT = 5;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sequential "Refresh prices" run over stale/errored Coles ingredients — see bulkRefresh design notes. */
export function BulkRefreshBar({ eligibleCount }: { eligibleCount: number }) {
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
      targets = await getBulkRefreshTargets();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Couldn't start refresh");
      setRunning(false);
      return;
    }

    if (targets.length === 0) {
      setToast("Nothing to refresh");
      setRunning(false);
      return;
    }

    let updated = 0;
    let failed = 0;
    let consecutiveEmpty = 0;
    let stoppedReason: string | null = null;

    for (let i = 0; i < targets.length; i++) {
      if (cancelledRef.current) break;
      setProgress({ index: i + 1, total: targets.length, name: targets[i].name });

      const result = await bulkRefreshItem(targets[i].productOptionId);
      if (result.ok) {
        updated++;
        consecutiveEmpty = 0;
      } else {
        failed++;
        consecutiveEmpty++;
      }

      if (consecutiveEmpty >= CONSECUTIVE_EMPTY_LIMIT) {
        stoppedReason = "Coles isn't responding — try again later";
        break;
      }

      if (i < targets.length - 1) await delay(ITEM_DELAY_MS);
    }

    setProgress(null);
    setRunning(false);
    router.refresh();
    setToast(stoppedReason ?? (failed > 0 ? `Updated ${updated} · ${failed} failed` : `Updated ${updated}`));
  }

  function stop() {
    cancelledRef.current = true;
  }

  return (
    <div className="px-4 pb-1">
      {running && progress ? (
        <div className="flex items-center gap-3 py-2 text-sm text-(--color-ink-muted)">
          <Spinner size={16} />
          <span className="min-w-0 flex-1 truncate">
            Refreshing {progress.index} of {progress.total} · {progress.name}
          </span>
          <button type="button" onClick={stop} className="shrink-0 font-medium text-(--color-accent)">
            Stop
          </button>
        </div>
      ) : (
        <div className="flex justify-end py-1">
          <button
            type="button"
            onClick={start}
            disabled={eligibleCount === 0}
            className="text-sm font-medium text-(--color-accent) disabled:text-(--color-ink-muted)"
          >
            Refresh prices{eligibleCount > 0 ? ` (${eligibleCount})` : ""}
          </button>
        </div>
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
