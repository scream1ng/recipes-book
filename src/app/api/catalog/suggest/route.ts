import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchCatalog } from "@/lib/actions/catalog";
import { prisma } from "@/lib/db";

/**
 * Backs the manual-entry autocomplete: local catalog matches (pg_trgm) plus
 * whatever is already sitting in the 24h Coles cache for this query. Zero
 * Gemini calls on this path — a cache miss just means no Coles suggestions
 * yet, not a live fetch.
 */
export async function GET(request: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ catalog: [], coles: [] });

  const [catalog, cached] = await Promise.all([
    searchCatalog(q),
    prisma.colesSearchCache.findUnique({
      where: { queryKey: q.toLowerCase().replace(/\s+/g, " ") },
    }),
  ]);

  const coles = cached && cached.expiresAt > new Date() ? JSON.parse(cached.resultsJson) : [];

  return NextResponse.json({ catalog, coles });
}
