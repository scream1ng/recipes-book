export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { generateJson } from "@/lib/gemini/client";
import { recipeParseResultSchema } from "@/lib/gemini/schemas";
import {
  buildRecipeTextParseSystemPrompt,
  buildRecipeTextParseUserPrompt,
} from "@/lib/gemini/prompts/recipe-parse-text";
import { prisma } from "@/lib/db";

const MAX_CHARS = 50_000;

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text) {
    return NextResponse.json({ error: "Paste some recipe text first." }, { status: 400 });
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "That's a lot of text. Trim it down to just the recipe and try again." },
      { status: 413 }
    );
  }

  const catalog = await prisma.catalogIngredient.findMany({
    where: { userId },
    select: { id: true, name: true },
  });

  try {
    const result = await generateJson({
      userId,
      kind: "RECIPE_PARSE",
      systemPrompt: buildRecipeTextParseSystemPrompt(catalog),
      prompt: buildRecipeTextParseUserPrompt(text),
      schema: recipeParseResultSchema,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Couldn't read that. Try again." }, { status: 502 });
  }
}
