// Paystack (cards, M-Pesa via Paystack, bank). Server-only.
function key() {
  const k = process.env["PAYSTACK_SECRET_KEY"];
  if (!k) throw new Error("Paystack is not configured yet.");
  return k;
}

export async function paystackInit(o: { email: string; amount: number; reference: string; callbackUrl: string; metadata?: Record<string, unknown> }) {
  const r = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: o.email, amount: Math.round(o.amount * 100), currency: "KES",
      reference: o.reference, callback_url: o.callbackUrl, metadata: o.metadata,
    }),
  });
  const j = (await r.json()) as { status?: boolean; message?: string; data?: { authorization_url: string } };
  if (!r.ok || !j.status || !j.data) throw new Error(`Paystack: ${j.message ?? r.status}`);
  return j.data.authorization_url;
}

export async function paystackVerify(reference: string): Promise<{ done: boolean; ok: boolean; amount: number; desc: string }> {
  const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${key()}` },
  });
  if (!r.ok) throw new Error(`Paystack verification failed (${r.status})`);
  const j = (await r.json()) as { data?: { status: string; amount: number; currency: string; gateway_response?: string } };
  const s = j.data?.status;
  if (!s || s === "ongoing" || s === "pending" || s === "abandoned") return { done: false, ok: false, amount: 0, desc: "Waiting" };
  const details = j.data;
  if (!details) return { done: false, ok: false, amount: 0, desc: "Waiting" };
  return { done: true, ok: s === "success" && details.currency === "KES", amount: details.amount / 100, desc: details.gateway_response ?? s };
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body using the secret key. */
export async function paystackSignatureOk(raw: string, sig: string | null) {
  if (!sig) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key()), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(raw)));
  const hex = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
