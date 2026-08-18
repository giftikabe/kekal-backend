/**
 * Thin client around Chapa's REST API (https://developer.chapa.co).
 *
 * Runs on Cloudflare Workers, so this deliberately avoids Node's `crypto`
 * module and uses the Web Crypto (SubtleCrypto) API instead — that's what
 * makes verifyChapaSignature() usable in this runtime.
 */

const CHAPA_BASE_URL = 'https://api.chapa.co/v1';

export class ChapaError extends Error {
  constructor(message: string, public readonly raw?: unknown) {
    super(message);
    this.name = 'ChapaError';
  }
}

/**
 * Chapa has no dedicated "am I authenticated" endpoint. The documented
 * convention (used here) is to call a lightweight authenticated GET — the
 * supported-banks list — and treat a 200 as proof the secret key is live,
 * and a 401/403 as an invalid key. This is what gates
 * commerce_settings.is_active on save.
 */
export async function verifyChapaKeys(secretKey: string): Promise<boolean> {
  const res = await fetch(`${CHAPA_BASE_URL}/banks`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  return res.ok;
}

export interface InitializePaymentParams {
  secretKey: string;
  amount: number;
  /** ISO-ish currency code as Chapa expects it, e.g. "ETB" or "USD". */
  currency: string;
  /** Our order_number — doubles as Chapa's tx_ref so webhook lookups are a single indexed query. */
  txRef: string;
  contactName: string;
  contactEmail?: string;
  callbackUrl: string;
  returnUrl: string;
}

export interface InitializePaymentResult {
  checkoutUrl: string;
  raw: unknown;
}

export async function initializeChapaPayment(
  params: InitializePaymentParams,
): Promise<InitializePaymentResult> {
  const [firstName, ...rest] = params.contactName.trim().split(/\s+/);
  const lastName = rest.join(' ') || firstName;

  const res = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amount.toFixed(2),
      currency: params.currency,
      // No customer-account system exists to source a real email from —
      // fall back to a guest placeholder scoped to this order.
      email: params.contactEmail ?? `guest+${params.txRef}@kekalliving.com`,
      first_name: firstName,
      last_name: lastName,
      tx_ref: params.txRef,
      callback_url: params.callbackUrl,
      return_url: params.returnUrl,
      customization: {
        title: 'Kekal Living',
        description: `Order ${params.txRef}`,
      },
    }),
  });

  const json = (await res.json()) as any;

  if (!res.ok || json?.status !== 'success' || !json?.data?.checkout_url) {
    throw new ChapaError('Chapa payment initialization failed', json);
  }

  return { checkoutUrl: json.data.checkout_url as string, raw: json };
}

export interface VerifyTransactionResult {
  status: 'success' | 'failed';
  raw: unknown;
}

/**
 * Defense in depth for the webhook handler: rather than trusting the webhook
 * body's own "status" field, re-fetch the transaction status directly from
 * Chapa using the secret key before mutating an order/payment.
 */
export async function verifyChapaTransaction(
  txRef: string,
  secretKey: string,
): Promise<VerifyTransactionResult> {
  const res = await fetch(`${CHAPA_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const json = (await res.json()) as any;
  const status: 'success' | 'failed' = json?.status === 'success' && json?.data?.status === 'success' ? 'success' : 'failed';
  return { status, raw: json };
}

/**
 * Verifies the `Chapa-Signature` header Chapa attaches to webhook deliveries
 * (HMAC-SHA256 of the raw request body, keyed with the merchant's secret
 * key). Must be run against the *raw* body string — parse JSON only after
 * this check passes.
 */
export async function verifyChapaSignature(
  rawBody: string,
  signatureHeader: string | null,
  secretKey: string,
): Promise<boolean> {
  if (!signatureHeader) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const computedHex = [...new Uint8Array(sigBuffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return timingSafeEqualHex(computedHex, signatureHeader.trim().toLowerCase());
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
