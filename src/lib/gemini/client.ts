import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import { prisma } from "@/lib/db";
import type { GeminiUsageKind } from "@/generated/prisma";

const MODEL_CHAIN = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"] as const;
const TIMEOUT_MS = 30_000;

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super(
      "GEMINI_API_KEY is not set. Configure it in .env to enable recipe scanning and Coles price parsing."
    );
    this.name = "GeminiNotConfiguredError";
  }
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

export interface ImagePart {
  mimeType: string;
  data: Buffer;
}

interface GenerateJsonParams<T> {
  userId: string;
  kind: GeminiUsageKind;
  systemPrompt: string;
  prompt: string;
  image?: ImagePart;
  schema: ZodType<T>;
}

/** Strips markdown code fences models sometimes wrap JSON in, despite instructions not to. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

async function callModel(
  model: string,
  systemPrompt: string,
  prompt: string,
  image?: ImagePart
): Promise<string> {
  const genai = getClient();
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  if (image) {
    parts.push({
      inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await genai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        abortSignal: controller.signal,
      },
    });
    return response.text ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /429/.test(message) ||
    /5\d\d/.test(message) ||
    /timeout|aborted/i.test(message)
  );
}

/**
 * Calls Gemini through the model chain (primary, then progressively
 * lighter fallbacks) on 429/5xx/timeout/schema-validation-failure, validates the JSON response
 * against `schema`, and logs the attempt to GeminiUsageLog. Throws on total
 * failure (both models exhausted).
 */
export async function generateJson<T>(params: GenerateJsonParams<T>): Promise<T> {
  const { userId, kind, systemPrompt, prompt, image, schema } = params;

  let lastError: unknown = null;

  for (const model of MODEL_CHAIN) {
    try {
      const raw = await callModel(model, systemPrompt, prompt, image);
      const parsed = JSON.parse(extractJson(raw));
      const result = schema.safeParse(parsed);

      if (!result.success) {
        lastError = new Error(`Schema validation failed: ${result.error.message}`);
        await logUsage({ userId, kind, model, ok: false });
        continue; // try fallback model
      }

      await logUsage({ userId, kind, model, ok: true });
      return result.data;
    } catch (err) {
      lastError = err;
      await logUsage({ userId, kind, model, ok: false });
      if (!isRetryableError(err)) throw err;
      // else fall through to next attempt
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini request failed after retries");
}

async function logUsage(entry: {
  userId: string;
  kind: GeminiUsageKind;
  model: string;
  ok: boolean;
  inputTokens?: number;
  outputTokens?: number;
}) {
  try {
    await prisma.geminiUsageLog.create({
      data: {
        userId: entry.userId,
        kind: entry.kind,
        model: entry.model,
        ok: entry.ok,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
      },
    });
  } catch {
    // Usage logging must never break the primary request.
  }
}
