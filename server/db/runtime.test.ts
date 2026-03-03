import { describe, it, expect } from "vitest";
import { readNonNegativeIntEnv, REVIEW_MEETING_ONESHOT_TIMEOUT_MS, REVIEW_MAX_ROUNDS, REVIEW_FINAL_DECISION_ROUND } from "./runtime.ts";

describe("readNonNegativeIntEnv", () => {
  it("returns fallback when env var is not set", () => {
    expect(readNonNegativeIntEnv("__TEST_NONEXISTENT__", 42)).toBe(42);
  });

  it("returns fallback for negative values", () => {
    process.env.__TEST_NEG__ = "-5";
    expect(readNonNegativeIntEnv("__TEST_NEG__", 100)).toBe(100);
    delete process.env.__TEST_NEG__;
  });

  it("returns fallback for non-numeric values", () => {
    process.env.__TEST_NAN__ = "abc";
    expect(readNonNegativeIntEnv("__TEST_NAN__", 50)).toBe(50);
    delete process.env.__TEST_NAN__;
  });

  it("floors decimal values", () => {
    process.env.__TEST_DEC__ = "3.7";
    expect(readNonNegativeIntEnv("__TEST_DEC__", 0)).toBe(3);
    delete process.env.__TEST_DEC__;
  });
});

describe("runtime constants", () => {
  it("REVIEW_MEETING_ONESHOT_TIMEOUT_MS is a positive number", () => {
    expect(REVIEW_MEETING_ONESHOT_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("REVIEW_MAX_ROUNDS >= REVIEW_FINAL_DECISION_ROUND", () => {
    expect(REVIEW_MAX_ROUNDS).toBeGreaterThanOrEqual(REVIEW_FINAL_DECISION_ROUND);
  });
});
