import { describe, it, expect } from "vitest";
import { validatePasswordChange } from "./password";

describe("validatePasswordChange", () => {
  it("accepts a strong, different, confirmed password", () => {
    expect(validatePasswordChange("old-password-1", "a-much-better-one", "a-much-better-one")).toBeNull();
  });

  it("requires the current password", () => {
    expect(validatePasswordChange("", "a-much-better-one", "a-much-better-one")).toMatch(/current password/);
  });

  it("rejects a short new password", () => {
    expect(validatePasswordChange("old-password-1", "short", "short")).toMatch(/at least 10/);
  });

  it("rejects reusing the current password", () => {
    expect(validatePasswordChange("same-password-1", "same-password-1", "same-password-1")).toMatch(/different/);
  });

  it("rejects a mismatched confirmation", () => {
    expect(validatePasswordChange("old-password-1", "a-much-better-one", "a-much-better-two")).toMatch(/don't match/);
  });
});
