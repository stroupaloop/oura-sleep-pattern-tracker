import { afterEach, describe, expect, it } from "vitest";
import {
  getAllowedEmails,
  getAuthorEmail,
  getPrimarySensitiveEmail,
  isAuthorEmail,
  isPrimarySensitiveEmail,
  isSensitiveEmail,
} from "./access";

const originalSensitiveEmails = process.env.SENSITIVE_EMAILS;
const originalAllowedEmails = process.env.ALLOWED_EMAILS;
const originalAuthorEmail = process.env.THOUGHTS_AUTHOR_EMAIL;

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restore("SENSITIVE_EMAILS", originalSensitiveEmails);
  restore("ALLOWED_EMAILS", originalAllowedEmails);
  restore("THOUGHTS_AUTHOR_EMAIL", originalAuthorEmail);
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

describe("getAllowedEmails", () => {
  it("parses a plain comma-separated list", () => {
    process.env.ALLOWED_EMAILS = "a@example.com,b@example.com";
    expect(getAllowedEmails()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("trims whitespace and lowercases", () => {
    process.env.ALLOWED_EMAILS = " A@Example.com ,  B@EXAMPLE.COM ";
    expect(getAllowedEmails()).toEqual(["a@example.com", "b@example.com"]);
  });

  it("survives a value wrapped in double quotes", () => {
    // A hosting dashboard keeps pasted quotes literally, which previously
    // corrupted the first and last entries and silently rejected them.
    process.env.ALLOWED_EMAILS =
      '"first@example.com, middle@example.com, last@example.com"';
    expect(getAllowedEmails()).toEqual([
      "first@example.com",
      "middle@example.com",
      "last@example.com",
    ]);
  });

  it("survives single quotes too", () => {
    process.env.ALLOWED_EMAILS = "'only@example.com'";
    expect(getAllowedEmails()).toEqual(["only@example.com"]);
  });

  it("is empty when unset", () => {
    delete process.env.ALLOWED_EMAILS;
    expect(getAllowedEmails()).toEqual([]);
  });
});

describe("quoted sensitive list", () => {
  it("does not let wrapping quotes break the primary owner", () => {
    process.env.SENSITIVE_EMAILS = '"her@example.com, them@example.com"';
    expect(getPrimarySensitiveEmail()).toBe("her@example.com");
    expect(isPrimarySensitiveEmail("her@example.com")).toBe(true);
    expect(isSensitiveEmail("them@example.com")).toBe(true);
  });
});

describe("author helpers", () => {
  it("prefers the explicit author variable", () => {
    process.env.THOUGHTS_AUTHOR_EMAIL = "Me@Example.com";
    process.env.ALLOWED_EMAILS = "someone@example.com";
    expect(getAuthorEmail()).toBe("me@example.com");
    expect(isAuthorEmail("ME@EXAMPLE.COM")).toBe(true);
    expect(isAuthorEmail("someone@example.com")).toBe(false);
  });

  it("falls back to the first allowed email", () => {
    delete process.env.THOUGHTS_AUTHOR_EMAIL;
    process.env.ALLOWED_EMAILS = "first@example.com,second@example.com";
    expect(getAuthorEmail()).toBe("first@example.com");
    expect(isAuthorEmail("first@example.com")).toBe(true);
    expect(isAuthorEmail("second@example.com")).toBe(false);
  });

  it("is not fooled by a quoted allowlist when falling back", () => {
    delete process.env.THOUGHTS_AUTHOR_EMAIL;
    process.env.ALLOWED_EMAILS = '"first@example.com, second@example.com"';
    expect(getAuthorEmail()).toBe("first@example.com");
    expect(isAuthorEmail("first@example.com")).toBe(true);
  });

  it("authorises nobody when nothing is configured", () => {
    delete process.env.THOUGHTS_AUTHOR_EMAIL;
    delete process.env.ALLOWED_EMAILS;
    expect(getAuthorEmail()).toBeNull();
    expect(isAuthorEmail("anyone@example.com")).toBe(false);
  });
});
