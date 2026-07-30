import { afterEach, describe, expect, it } from "vitest";
import {
  getPrimarySensitiveEmail,
  isPrimarySensitiveEmail,
  isSensitiveEmail,
} from "./access";

const originalSensitiveEmails = process.env.SENSITIVE_EMAILS;

afterEach(() => {
  if (originalSensitiveEmails === undefined) {
    delete process.env.SENSITIVE_EMAILS;
  } else {
    process.env.SENSITIVE_EMAILS = originalSensitiveEmails;
  }
});

describe("sensitive email ownership", () => {
  it("allows every listed viewer but assigns profile ownership to the first", () => {
    process.env.SENSITIVE_EMAILS = "Owner@Example.com, viewer@example.com";

    expect(getPrimarySensitiveEmail()).toBe("owner@example.com");
    expect(isSensitiveEmail("viewer@example.com")).toBe(true);
    expect(isPrimarySensitiveEmail("OWNER@example.com")).toBe(true);
    expect(isPrimarySensitiveEmail("viewer@example.com")).toBe(false);
  });

  it("fails closed when no sensitive owner is configured", () => {
    delete process.env.SENSITIVE_EMAILS;

    expect(getPrimarySensitiveEmail()).toBeNull();
    expect(isSensitiveEmail("owner@example.com")).toBe(false);
    expect(isPrimarySensitiveEmail("owner@example.com")).toBe(false);
  });
});
