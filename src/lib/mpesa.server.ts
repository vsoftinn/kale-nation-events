// Safaricom Daraja (M-Pesa Express / STK Push). Server-only.
const SANDBOX_PASSKEY = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919"; // public Daraja sandbox passkey

function cfg() {
  const env = (process.env["MPESA_ENV"] || "sandbox").toLowerCase();
  const key = process.env["MPESA_CONSUMER_KEY"];
  const secret = process.env["MPESA_CONSUMER_SECRET"];
  if (!key || !secret) throw new Error("M-Pesa is not configured yet (consumer key/secret missing).");
  return {
    base: env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    key, secret,
    shortcode: process.env["MPESA_SHORTCODE"] || "174379",
    passkey: process.env["MPESA_PASSKEY"] || SANDBOX_PASSKEY,
    callback: process.env["MPESA_CALLBACK_URL"] || "https://kale-ticket-garden.lovable.app/api/public/mpesa/callback",
  };
}

/** 07xx / +2547xx / 2547xx / 01xx → 2547xxxxxxxx; null if invalid. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const m = d.match(/^(?:254|0)?([17]\d{8})$/);
  return m ? `254${m[1]}` : null;
}

function nairobiTimestamp(now = new Date()) {
  const t = new Date(now.getTime() + 3 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}${p(t.getUTCHours())}${p(t.getUTCMinutes())}${p(t.getUTCSeconds())}`;
}

async function token(c: ReturnType<typeof cfg>) {
  const r = await fetch(`${c.base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${c.key}:${c.secret}`)}` },
  });
  if (!r.ok) throw new Error(`M-Pesa auth failed (${r.status})`);
  return ((await r.json()) as { access_token: string }).access_token;
}

export async function stkPush(o: { callback?: string; phone: string; amount: number; reference: string; desc: string }) {
  const c = cfg();
  const ts = nairobiTimestamp();
  const r = await fetch(`${c.base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token(c)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: c.shortcode,
      Password: btoa(`${c.shortcode}${c.passkey}${ts}`),
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(o.amount),
      PartyA: o.phone,
      PartyB: c.shortcode,
      PhoneNumber: o.phone,
      CallBackURL: process.env["MPESA_CALLBACK_URL"] || o.callback || c.callback,
      AccountReference: o.reference.slice(0, 12),
      TransactionDesc: o.desc.slice(0, 13),
    }),
  });
  const j = (await r.json()) as { ResponseCode?: string; CheckoutRequestID?: string; errorMessage?: string; ResponseDescription?: string };
  if (j.ResponseCode !== "0" || !j.CheckoutRequestID) throw new Error(j.errorMessage || j.ResponseDescription || "M-Pesa request failed");
  return j.CheckoutRequestID;
}

/** Ask Safaricom for the result (used when the callback hasn't arrived). */
export async function stkQuery(checkoutId: string): Promise<{ done: boolean; ok: boolean; desc: string }> {
  const c = cfg();
  const ts = nairobiTimestamp();
  const r = await fetch(`${c.base}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token(c)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ BusinessShortCode: c.shortcode, Password: btoa(`${c.shortcode}${c.passkey}${ts}`), Timestamp: ts, CheckoutRequestID: checkoutId }),
  });
  const j = (await r.json()) as { ResultCode?: string; ResultDesc?: string; errorCode?: string };
  if (j.ResultCode === undefined) return { done: false, ok: false, desc: "Waiting" }; // still processing
  return { done: true, ok: j.ResultCode === "0", desc: j.ResultDesc ?? "" };
}

export const ticketCode = () =>
  `KN-${Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("")}`;
