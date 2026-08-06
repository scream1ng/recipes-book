import { describe, it, expect } from "vitest";
import {
  generateResetToken,
  hashResetToken,
  resetTokenExpiry,
  evaluateResetToken,
  RESET_TOKEN_TTL_MINUTES,
} from "../reset-token";

describe("generateResetToken", () => {
  it("returns a high-entropy, url-safe string", () => {
    const token = generateResetToken();
    expect(token.length).toBeGreaterThan(30);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is different on every call", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).not.toBe(b);
  });
});

describe("hashResetToken", () => {
  it("is deterministic", () => {
    const token = generateResetToken();
    expect(hashResetToken(token)).toBe(hashResetToken(token));
  });

  it("is not the identity function", () => {
    const token = generateResetToken();
    expect(hashResetToken(token)).not.toBe(token);
  });

  it("produces different hashes for different tokens", () => {
    expect(hashResetToken(generateResetToken())).not.toBe(hashResetToken(generateResetToken()));
  });
});

describe("resetTokenExpiry", () => {
  it(`is ${RESET_TOKEN_TTL_MINUTES} minutes from now`, () => {
    const before = Date.now();
    const expiry = resetTokenExpiry();
    const after = Date.now();
    const expectedMs = RESET_TOKEN_TTL_MINUTES * 60_000;

    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + expectedMs);
  });
});

describe("evaluateResetToken", () => {
  const now = new Date("2026-01-01T00:00:00Z");

  it("is valid when unused and unexpired", () => {
    const token = { expiresAt: new Date("2026-01-01T01:00:00Z"), usedAt: null };
    expect(evaluateResetToken(token, now)).toBe("valid");
  });

  it("is used when usedAt is set, even if not yet expired", () => {
    const token = {
      expiresAt: new Date("2026-01-01T01:00:00Z"),
      usedAt: new Date("2025-12-31T23:00:00Z"),
    };
    expect(evaluateResetToken(token, now)).toBe("used");
  });

  it("is expired when past expiresAt and unused", () => {
    const token = { expiresAt: new Date("2025-12-31T23:00:00Z"), usedAt: null };
    expect(evaluateResetToken(token, now)).toBe("expired");
  });

  it("is valid exactly at the expiry boundary (strict less-than)", () => {
    const token = { expiresAt: now, usedAt: null };
    expect(evaluateResetToken(token, now)).toBe("valid");
  });

  it("is expired one millisecond past the boundary", () => {
    const token = { expiresAt: now, usedAt: null };
    const justAfter = new Date(now.getTime() + 1);
    expect(evaluateResetToken(token, justAfter)).toBe("expired");
  });
});
