import "server-only";

/**
 * Builds the system prompt for parsing a Coles search-results HTML page
 * (already trimmed by lib/scrape/html-trim.ts) into structured products.
 * We use an LLM instead of CSS selectors because Coles' markup shifts
 * often enough that brittle selectors break silently.
 */
export function buildColesHtmlParseSystemPrompt(query: string): string {
  return `You are extracting grocery product listings from a trimmed HTML fragment of a Coles.com.au search results page for the query "${query}".

Return STRICT JSON matching this shape (no markdown fences, no commentary):

{
  "products": [
    {
      "name": string,             // product name as shown
      "packLabel": string,        // pack size as displayed, e.g. "1kg", "500g", "6 pack"
      "packQty": number | null,   // packLabel converted to grams (mass) or ml (volume) if determinable, else null
      "priceCents": number | null,// price in cents, e.g. $4.50 -> 450
      "productUrl": string | null,
      "productId": string | null  // Coles product id/slug if present in the URL or markup
    }
  ]
}

Rules:
- Only include real products with a visible price; skip ads, banners, and "you may also like" sections if identifiable.
- If a field can't be determined, use null rather than guessing.
- Output must be valid JSON only.`;
}

export const COLES_HTML_PARSE_USER_PROMPT_PREFIX =
  "Here is the trimmed HTML fragment:\n\n";
