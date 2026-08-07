import "server-only";
import type { ColesProduct } from "@/lib/gemini/schemas";
import { extractNextData, mapToColesProducts } from "./coles-next-data";

const COLES_SEARCH_URL = "https://www.coles.com.au/search/products";

// Chrome UA and sec-ch-ua version must stay in sync — Coles' bot defense
// (Imperva/Incapsula) treats a mismatched pair as a bot signal, and so does a
// version claiming to be current long after Chrome has moved past it. Update
// both together.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const SEC_CH_UA = '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"';

const FETCH_TIMEOUT_MS = 10_000;

export class ColesFetchError extends Error {}
export class ColesBlockedError extends ColesFetchError {}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-AU,en;q=0.9",
        "sec-ch-ua": SEC_CH_UA,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Coles' bot defense can return a 200 with a JS challenge page instead of
// real results — indistinguishable from "no results" unless checked for
// explicitly.
const BOT_BLOCK_MARKER = "Pardon Our Interruption";

// Server-side pacing: burst requests trip Coles' bot defense even with
// correct headers (confirmed live — request 5 of a 2s-spaced run got
// blocked). This app is single-user/single-instance (see ratelimit.ts), so
// a module-level gate is sufficient: one Coles fetch in flight at a time,
// spaced out, with a cooldown once a block is seen so we stop hammering a
// site that's already told us no.
//
// Two speeds: "bulk" (the price-run loop, genuinely bursty — this is what
// tripped the block in testing) gets the full spacing. "interactive"
// (autocomplete, swap sheet — a person waiting on screen, usually one-off)
// gets a much shorter minimum; it still only applies when a fetch landed
// recently, so an isolated lookup after any period of idle time is instant.
// Not proven safe against Coles under sustained rapid-fire interactive use —
// if that turns out to trip the block too, tighten INTERACTIVE_MIN_GAP_MS.
const BULK_MIN_GAP_MS = 6_000;
const BULK_JITTER_MS = 3_000;
const INTERACTIVE_MIN_GAP_MS = 1_500;
const INTERACTIVE_JITTER_MS = 500;
const BLOCK_COOLDOWN_MS = 15 * 60 * 1000;

export type FetchPriority = "bulk" | "interactive";

let queueTail: Promise<unknown> = Promise.resolve();
let lastFetchAt = 0;
let blockedUntil = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scheduleFetch<T>(fn: () => Promise<T>, priority: FetchPriority): Promise<T> {
  const prevTail = queueTail;
  const result = new Promise<T>((resolve, reject) => {
    // Chained off a promise that always resolves — one call's failure must
    // never wedge every later-queued fetch behind it.
    queueTail = prevTail.then(async () => {
      // Checked outside the try below on purpose — rejecting here must not
      // hit the catch's "extend the cooldown" branch, or any traffic arriving
      // during an active cooldown keeps re-extending it and it never elapses.
      if (Date.now() < blockedUntil) {
        reject(new ColesBlockedError("Coles is temporarily blocking requests — try again later."));
        return;
      }
      try {
        const [base, jitter] =
          priority === "bulk" ? [BULK_MIN_GAP_MS, BULK_JITTER_MS] : [INTERACTIVE_MIN_GAP_MS, INTERACTIVE_JITTER_MS];
        const minGap = base + Math.random() * jitter;
        const wait = lastFetchAt + minGap - Date.now();
        if (wait > 0) await sleep(wait);
        lastFetchAt = Date.now();

        resolve(await fn());
      } catch (err) {
        if (err instanceof ColesBlockedError) blockedUntil = Date.now() + BLOCK_COOLDOWN_MS;
        reject(err);
      }
    });
  });
  return result;
}

/**
 * Fetches the Coles search results page HTML. Retries once on a network/
 * timeout failure; does NOT retry on a detected bot block — retrying a block
 * immediately is the surest way to escalate it, so that's surfaced as a
 * distinct, non-retried error instead. Calls are serialized and spaced via
 * `scheduleFetch`; `priority` controls how much (see constants above).
 */
export async function fetchColesSearchHtml(
  query: string,
  priority: FetchPriority = "bulk"
): Promise<string> {
  return scheduleFetch(() => fetchColesSearchHtmlUnthrottled(query), priority);
}

async function fetchColesSearchHtmlUnthrottled(query: string): Promise<string> {
  const url = `${COLES_SEARCH_URL}?q=${encodeURIComponent(query)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new ColesFetchError(`Coles search returned ${res.status}`);
      const html = await res.text();
      if (html.includes(BOT_BLOCK_MARKER)) {
        throw new ColesBlockedError("Coles blocked the request (bot challenge)");
      }
      return html;
    } catch (err) {
      if (err instanceof ColesBlockedError) throw err;
      if (attempt === 1) {
        throw err instanceof Error
          ? new ColesFetchError(`Failed to fetch Coles search results: ${err.message}`)
          : new ColesFetchError("Failed to fetch Coles search results");
      }
      // one retry, network/timeout errors only
    }
  }
  throw new ColesFetchError("Failed to fetch Coles search results");
}

/**
 * Fetches a Coles search query and extracts structured products from the
 * `__NEXT_DATA__` payload the page ships — deterministic, no LLM round trip.
 * On any failure (network, block, or an unexpected/drifted payload shape)
 * this throws — callers should catch and leave pricing fields blank rather
 * than block the user, per spec.
 */
export async function searchColesProducts(
  query: string,
  priority: FetchPriority = "bulk"
): Promise<ColesProduct[]> {
  const html = await fetchColesSearchHtml(query, priority);

  const data = extractNextData(html);
  if (!data) {
    throw new ColesFetchError("Coles search page didn't include the expected product data");
  }

  return mapToColesProducts(data);
}
