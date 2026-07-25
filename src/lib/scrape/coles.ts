import "server-only";
import { generateJson } from "@/lib/gemini/client";
import { colesParseResultSchema, type ColesProduct } from "@/lib/gemini/schemas";
import { buildColesHtmlParseSystemPrompt, COLES_HTML_PARSE_USER_PROMPT_PREFIX } from "@/lib/gemini/prompts/coles-html-parse";
import { trimHtmlForParsing } from "./html-trim";

const COLES_SEARCH_URL = "https://www.coles.com.au/search/products";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 10_000;

export class ColesFetchError extends Error {}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetches the Coles search results page HTML, with one retry on failure. */
export async function fetchColesSearchHtml(query: string): Promise<string> {
  const url = `${COLES_SEARCH_URL}?q=${encodeURIComponent(query)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new ColesFetchError(`Coles search returned ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === 1) {
        throw err instanceof Error
          ? new ColesFetchError(`Failed to fetch Coles search results: ${err.message}`)
          : new ColesFetchError("Failed to fetch Coles search results");
      }
      // one retry
    }
  }
  throw new ColesFetchError("Failed to fetch Coles search results");
}

/**
 * Fetches + Gemini-parses a Coles search query into structured products.
 * On any failure (network, scrape, or parse) this throws — callers should
 * catch and leave pricing fields blank rather than block the user, per spec.
 */
export async function searchColesProducts(userId: string, query: string): Promise<ColesProduct[]> {
  const html = await fetchColesSearchHtml(query);
  const trimmed = trimHtmlForParsing(html);

  const result = await generateJson({
    userId,
    kind: "COLES_HTML_PARSE",
    systemPrompt: buildColesHtmlParseSystemPrompt(query),
    prompt: `${COLES_HTML_PARSE_USER_PROMPT_PREFIX}${trimmed}`,
    schema: colesParseResultSchema,
  });

  return result.products;
}
