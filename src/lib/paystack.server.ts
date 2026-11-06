function secretKey(): string {
  const secret = process.env["PAYSTACK_SECRET_KEY"]?.trim();
  if (!secret) throw new Error("Paystack is not configured.");
  return secret;
}

export function assertPaystackConfigured(): void {
  secretKey();
}

export async function paystackInit(input: {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  if (!Number.isSafeInteger(input.amount) || input.amount < 1) {
    throw new Error("Paystack requires a positive whole-shilling amount.");
  }
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amount * 100,
      currency: "KES",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = (await response.json()) as {
    status?: boolean;
    data?: { authorization_url?: string };
  };
  const authorizationUrl = result.data?.authorization_url;
  if (!response.ok || !result.status || !authorizationUrl?.startsWith("https://")) {
    throw new Error("Paystack did not provide a valid checkout link.");
  }
  return authorizationUrl;
}

export async function paystackVerify(reference: string): Promise<{
  done: boolean;
  ok: boolean;
  amountSubunits: number;
  currency: string | null;
  desc: string;
}> {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${secretKey()}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  const result = (await response.json()) as {
    status?: boolean;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      reference?: string;
      gateway_response?: string;
    };
  };
  const transaction = result.data;
  if (!response.ok || !result.status || !transaction) {
    throw new Error("Could not verify the Paystack transaction.");
  }
  if (transaction.reference !== reference) {
    throw new Error("Paystack returned a different transaction reference.");
  }
  const state = transaction.status;
  if (!state || ["ongoing", "pending", "abandoned"].includes(state)) {
    return {
      done: false,
      ok: false,
      amountSubunits: 0,
      currency: transaction.currency ?? null,
      desc: "Waiting for Paystack confirmation.",
    };
  }
  return {
    done: true,
    ok: state === "success",
    amountSubunits: transaction.amount ?? 0,
    currency: transaction.currency ?? null,
    desc: transaction.gateway_response ?? state,
  };
}

export async function paystackSignatureOk(raw: string, signature: string | null): Promise<boolean> {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey()),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)),
  );
  const expected = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.toLowerCase().charCodeAt(index);
  }
  return mismatch === 0;
}
