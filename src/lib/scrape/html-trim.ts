import "server-only";

/**
 * Strips script/style/svg/noscript content and collapses whitespace so the
 * HTML we send to Gemini for parsing is small and cheap, while keeping the
 * text/attributes an LLM needs to identify product name/pack/price.
 */
export function trimHtmlForParsing(html: string, maxChars = 60_000): string {
  let trimmed = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (trimmed.length > maxChars) {
    trimmed = trimmed.slice(0, maxChars);
  }

  return trimmed;
}
