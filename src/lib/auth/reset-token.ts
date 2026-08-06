import { randomBytes, createHash } from "crypto";

export const RESET_TOKEN_TTL_MINUTES = 60;

/** Raw, single-use reset token — this value goes in the emailed link, never stored. */
export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Deterministic, one-way — only the hash is stored, so a DB read alone can't forge a link. */
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function resetTokenExpiry(): Date {
  return new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000);
}

export type ResetTokenStatus = "valid" | "expired" | "used";

/** Pure predicate, kept separate from the DB lookup so it's unit-testable without Prisma. */
export function evaluateResetToken(
  token: { expiresAt: Date; usedAt: Date | null },
  now: Date = new Date()
): ResetTokenStatus {
  if (token.usedAt) return "used";
  if (token.expiresAt < now) return "expired";
  return "valid";
}
