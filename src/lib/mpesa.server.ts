import { randomBytes } from "node:crypto";

type MpesaConfig = {
  base: string;
  key: string;
  secret: string;
  shortcode: string;
  passkey: string;
  callback: string;
  transactionType: "CustomerPayBillOnline" | "CustomerBuyGoodsOnline";
};

function config(): MpesaConfig {
  const environment = (process.env["MPESA_ENVIRONMENT"] || process.env["MPESA_ENV"] || "sandbox")
    .trim()
    .toLowerCase();
  const key = process.env["MPESA_CONSUMER_KEY"]?.trim();
  const secret = process.env["MPESA_CONSUMER_SECRET"]?.trim();
  const shortcode = process.env["MPESA_SHORTCODE"]?.trim();
  const passkey = process.env["MPESA_PASSKEY"]?.trim();
  const callback = process.env["MPESA_CALLBACK_URL"]?.trim();
  const transactionType = process.env["MPESA_TRANSACTION_TYPE"]?.trim() || "CustomerPayBillOnline";

  if (!key || !secret || !passkey) throw new Error("M-Pesa is not configured.");
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("MPESA_ENVIRONMENT must be sandbox or production.");
  }
  if (transactionType !== "CustomerPayBillOnline" && transactionType !== "CustomerBuyGoodsOnline") {
    throw new Error("MPESA_TRANSACTION_TYPE is invalid.");
  }
  if (environment === "production" && (!shortcode || !passkey)) {
    throw new Error("Production M-Pesa shortcode and passkey are required.");
  }

  const baseUrl = process.env["APP_BASE_URL"]?.trim() || "https://events.v-soft-innovations.com";
  const callbackUrl = callback || `${baseUrl.replace(/\/+$/, "")}/api/public/mpesa/callback`;
  if (!callbackUrl.startsWith("https://")) {
    throw new Error("M-Pesa callback URL must use HTTPS.");
  }

  return {
    base:
      environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke",
    key,
    secret,
    shortcode: shortcode || "174379",
    passkey,
    callback: callbackUrl,
    transactionType,
  };
}

export function assertMpesaConfigured(): void {
  config();
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s()+-]/g, "");
  const match = digits.match(/^(?:254|0)?([17]\d{8})$/);
  return match ? `254${match[1]}` : null;
}

function nairobiTimestamp(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values["year"]}${values["month"]}${values["day"]}${values["hour"]}${values["minute"]}${values["second"]}`;
}

async function accessToken(settings: MpesaConfig): Promise<string> {
  const credentials = Buffer.from(`${settings.key}:${settings.secret}`).toString("base64");
  const response = await fetch(`${settings.base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Could not authenticate with M-Pesa.");
  const result = (await response.json()) as { access_token?: string };
  if (!result.access_token) throw new Error("M-Pesa did not provide an access token.");
  return result.access_token;
}

async function request<T>(settings: MpesaConfig, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${settings.base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken(settings)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const result = (await response.json()) as T & {
    errorCode?: string;
    errorMessage?: string;
    ResponseCode?: string;
    ResponseDescription?: string;
  };
  if (!response.ok || result.errorCode) {
    throw new Error(result.errorMessage || "M-Pesa request failed.");
  }
  return result;
}

export async function stkPush(order: {
  phone: string;
  amount: number;
  reference: string;
  desc: string;
}): Promise<string> {
  if (!Number.isSafeInteger(order.amount) || order.amount < 1) {
    throw new Error("M-Pesa requires a positive whole-shilling amount.");
  }
  const settings = config();
  const timestamp = nairobiTimestamp();
  const result = await request<{
    ResponseCode?: string;
    ResponseDescription?: string;
    CheckoutRequestID?: string;
  }>(settings, "/mpesa/stkpush/v1/processrequest", {
    BusinessShortCode: settings.shortcode,
    Password: Buffer.from(`${settings.shortcode}${settings.passkey}${timestamp}`).toString(
      "base64",
    ),
    Timestamp: timestamp,
    TransactionType: settings.transactionType,
    Amount: order.amount,
    PartyA: order.phone,
    PartyB: settings.shortcode,
    PhoneNumber: order.phone,
    CallBackURL: settings.callback,
    AccountReference: order.reference.slice(0, 12),
    TransactionDesc: order.desc.slice(0, 13),
  });
  if (result.ResponseCode !== "0" || !result.CheckoutRequestID) {
    throw new Error(result.ResponseDescription || "M-Pesa did not accept the STK Push.");
  }
  return result.CheckoutRequestID;
}

export async function stkQuery(
  checkoutId: string,
): Promise<{ done: boolean; ok: boolean; desc: string }> {
  const settings = config();
  const timestamp = nairobiTimestamp();
  const result = await request<{
    ResultCode?: string | number;
    ResultDesc?: string;
  }>(settings, "/mpesa/stkpushquery/v1/query", {
    BusinessShortCode: settings.shortcode,
    Password: Buffer.from(`${settings.shortcode}${settings.passkey}${timestamp}`).toString(
      "base64",
    ),
    Timestamp: timestamp,
    CheckoutRequestID: checkoutId,
  });
  if (result.ResultCode === undefined) {
    return { done: false, ok: false, desc: "Waiting for M-Pesa confirmation." };
  }
  return {
    done: true,
    ok: String(result.ResultCode) === "0",
    desc: result.ResultDesc ?? "",
  };
}

export const ticketCode = (): string => `KN-${randomBytes(12).toString("hex").toUpperCase()}`;
