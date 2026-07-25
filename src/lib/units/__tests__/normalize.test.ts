import { describe, expect, it } from "vitest";
import { normalizeToCanonical, canonicalizeUnitToken, detectCanonicalUnitFromRawUnit } from "../normalize";

describe("canonicalizeUnitToken", () => {
  it("maps aliases and plurals", () => {
    expect(canonicalizeUnitToken("Tbsp.")).toBe("tbsp");
    expect(canonicalizeUnitToken("tablespoons")).toBe("tbsp");
    expect(canonicalizeUnitToken("grams")).toBe("g");
    expect(canonicalizeUnitToken("cups")).toBe("cup");
  });
});

describe("normalizeToCanonical", () => {
  it("converts mass units to grams", () => {
    expect(normalizeToCanonical(1, "kg", "MASS_G").qtyCanonical).toBe(1000);
    expect(normalizeToCanonical(2, "oz", "MASS_G").qtyCanonical).toBeCloseTo(56.699, 2);
  });

  it("converts volume units to ml", () => {
    expect(normalizeToCanonical(1, "cup", "VOLUME_ML").qtyCanonical).toBe(250);
    expect(normalizeToCanonical(3, "tsp", "VOLUME_ML").qtyCanonical).toBe(15);
  });

  it("converts volume->mass using gramsPerMl density", () => {
    // 1 cup flour ~ 125g -> gramsPerMl = 0.5
    const result = normalizeToCanonical(1, "cup", "MASS_G", { gramsPerMl: 0.5 });
    expect(result.qtyCanonical).toBe(125);
  });

  it("flags missing density factor instead of guessing", () => {
    const result = normalizeToCanonical(1, "cup", "MASS_G");
    expect(result.qtyCanonical).toBeNull();
    expect(result.missingFactor).toBe("gramsPerMl");
  });

  it("converts count via gramsPerCount", () => {
    const result = normalizeToCanonical(3, "each", "MASS_G", { gramsPerCount: 50 });
    expect(result.qtyCanonical).toBe(150);
  });

  it("passes through COUNT canonical unit unchanged", () => {
    expect(normalizeToCanonical(4, "whole", "COUNT").qtyCanonical).toBe(4);
  });
});

describe("detectCanonicalUnitFromRawUnit", () => {
  it("maps mass units to MASS_G", () => {
    expect(detectCanonicalUnitFromRawUnit("g")).toBe("MASS_G");
    expect(detectCanonicalUnitFromRawUnit("kg")).toBe("MASS_G");
  });

  it("maps volume units to VOLUME_ML", () => {
    expect(detectCanonicalUnitFromRawUnit("ml")).toBe("VOLUME_ML");
    expect(detectCanonicalUnitFromRawUnit("cup")).toBe("VOLUME_ML");
    expect(detectCanonicalUnitFromRawUnit("tbsp")).toBe("VOLUME_ML");
  });

  it("falls back to COUNT for count units, unknown units, or null", () => {
    expect(detectCanonicalUnitFromRawUnit("whole")).toBe("COUNT");
    expect(detectCanonicalUnitFromRawUnit("banana")).toBe("COUNT");
    expect(detectCanonicalUnitFromRawUnit(null)).toBe("COUNT");
  });
});
