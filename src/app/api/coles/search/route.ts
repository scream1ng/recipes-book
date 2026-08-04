import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getCachedColesResults } from "@/lib/scrape/coles-cache";
import { checkColesSearchRateLimit } from "@/lib/ratelimit";

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!checkColesSearchRateLimit(userId)) {
    return NextResponse.json({ error: "Too many searches, slow down." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const { products } = await getCachedColesResults(userId, query);
  return NextResponse.json({ products });
}
