import { describe, expect, it } from "vitest";
import { assertMpesaConfigured, normalizePhone } from "./mpesa.server";

describe("normalizePhone", () => {
  it.each([
    ["0712345678", "254712345678"],
    ["+254 712 345 678", "254712345678"],
    ["254112345678", "254112345678"],
  ])("normalizes %s to the Safaricom API format", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["12345678", "254612345678", "071234567890", "not a phone", "abc0712345678"])(
    "rejects invalid Kenyan mobile number %s",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe("M-Pesa environment configuration", () => {
  it("accepts MPESA_ENVIRONMENT and derives the callback from APP_BASE_URL", () => {
    const keys = [
      "MPESA_CONSUMER_KEY",
      "MPESA_CONSUMER_SECRET",
      "MPESA_ENV",
      "MPESA_ENVIRONMENT",
      "MPESA_SHORTCODE",
      "MPESA_PASSKEY",
      "MPESA_CALLBACK_URL",
      "MPESA_TRANSACTION_TYPE",
      "APP_BASE_URL",
    ] as const;
    const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

    process.env["MPESA_CONSUMER_KEY"] = "test-key";
    process.env["MPESA_CONSUMER_SECRET"] = "test-secret";
    process.env["MPESA_ENVIRONMENT"] = "production";
    process.env["MPESA_TRANSACTION_TYPE"] = "CustomerPayBillOnline";
    process.env["MPESA_SHORTCODE"] = "123456";
    process.env["MPESA_PASSKEY"] = "test-passkey";
    process.env["APP_BASE_URL"] = "https://events.example.test";
    delete process.env["MPESA_ENV"];
    delete process.env["MPESA_CALLBACK_URL"];

    try {
      expect(assertMpesaConfigured).not.toThrow();
    } finally {
      for (const key of keys) {
        const value = original[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
