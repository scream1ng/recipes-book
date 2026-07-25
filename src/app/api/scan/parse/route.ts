export const runtime = "nodejs";

import { NextResponse } from "next/server";
import heicConvert from "heic-convert";
import { requireUser } from "@/lib/auth";
import { generateJson } from "@/lib/gemini/client";
import { recipeParseResultSchema } from "@/lib/gemini/schemas";
import { buildRecipeParseSystemPrompt, RECIPE_PARSE_USER_PROMPT } from "@/lib/gemini/prompts/recipe-parse";
import { prisma } from "@/lib/db";

const MAX_BYTES = 15 * 1024 * 1024;

function isHeic(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "image file is required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 15MB)" }, { status: 413 });
  }

  // Image is held in memory for this request only and never written to disk
  // or persisted anywhere — discarded once this handler returns.
  let buffer = Buffer.from(await file.arrayBuffer());
  let mimeType = file.type || "image/jpeg";

  if (isHeic(file)) {
    try {
      const converted = await heicConvert({ buffer, format: "JPEG", quality: 0.92 });
      buffer = Buffer.from(converted);
      mimeType = "image/jpeg";
    } catch {
      return NextResponse.json(
        { error: "Could not convert HEIC photo. Try exporting as JPEG and re-uploading." },
        { status: 422 }
      );
    }
  }

  const catalog = await prisma.catalogIngredient.findMany({
    where: { userId },
    select: { id: true, name: true },
  });

  try {
    const result = await generateJson({
      userId,
      kind: "RECIPE_PARSE",
      systemPrompt: buildRecipeParseSystemPrompt(catalog),
      prompt: RECIPE_PARSE_USER_PROMPT,
      image: { mimeType, data: buffer },
      schema: recipeParseResultSchema,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recipe scan failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
