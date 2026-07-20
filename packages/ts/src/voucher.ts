import bs58 from "bs58";
import { DOMAIN, SCHEME_BATCH } from "./constants.js";
import { type AgentKeypair, signBytes } from "./keypair.js";

const ASCII = /^[\x20-\x7E]+$/;

export type VoucherFields = {
  channelId: string;
  payer: string;
  payTo: string;
  mint: string;
  cumulativeMicros: number;
  expiry: number;
  nonce: string;
};

export type PaymentPayload = {
  scheme: typeof SCHEME_BATCH;
  network: string;
  asset: string;
  payTo: string;
  payer: string;
  channelId: string;
  cumulativeMicros: number;
  expiry: number;
  nonce: string;
  signature: string;
};

export function voucherMessage(fields: VoucherFields): Uint8Array {
  const parts = [
    DOMAIN,
    fields.channelId,
    fields.payer,
    fields.payTo,
    fields.mint,
    String(Math.trunc(fields.cumulativeMicros)),
    String(Math.trunc(fields.expiry)),
    fields.nonce,
  ];
  for (const p of parts) {
    if (!ASCII.test(p)) throw new Error("voucher fields must be printable ASCII");
  }
  return new TextEncoder().encode(parts.join("|"));
}

export function signVoucher(
  keypair: AgentKeypair,
  fields: Omit<VoucherFields, "payer" | "channelId"> & {
    payer?: string;
    channelId?: string;
  },
): string {
  const payer = fields.payer ?? keypair.payer;
  const channelId = fields.channelId ?? payer;
  if (channelId !== payer) throw new Error("channelId must equal payer");
  const msg = voucherMessage({
    channelId,
    payer,
    payTo: fields.payTo,
    mint: fields.mint,
    cumulativeMicros: fields.cumulativeMicros,
    expiry: fields.expiry,
    nonce: fields.nonce,
  });
  return bs58.encode(signBytes(keypair.secretKey, msg));
}

export function buildPaymentPayload(
  keypair: AgentKeypair,
  opts: {
    network: string;
    payTo: string;
    mint: string;
    cumulativeMicros: number;
    expiry: number;
    nonce: string;
  },
): PaymentPayload {
  const payer = keypair.payer;
  const signature = signVoucher(keypair, {
    payer,
    channelId: payer,
    payTo: opts.payTo,
    mint: opts.mint,
    cumulativeMicros: opts.cumulativeMicros,
    expiry: opts.expiry,
    nonce: opts.nonce,
  });
  return {
    scheme: SCHEME_BATCH,
    network: opts.network,
    asset: opts.mint,
    payTo: opts.payTo,
    payer,
    channelId: payer,
    cumulativeMicros: opts.cumulativeMicros,
    expiry: opts.expiry,
    nonce: opts.nonce,
    signature,
  };
}

export function encodePaymentSignature(payload: PaymentPayload): string {
  // Compact JSON — must match Python json.dumps(separators=(",", ":"))
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export function decodePaymentRequired(header: string): {
  accepts: Array<{
    scheme: string;
    network?: string;
    asset?: string;
    amount?: string;
    payTo?: string;
  }>;
  error?: string;
} {
  const raw = Buffer.from(header.trim(), "base64").toString("utf8");
  const obj = JSON.parse(raw) as {
    accepts?: Array<Record<string, unknown>>;
    error?: string;
  };
  if (!obj || !Array.isArray(obj.accepts)) {
    throw new Error("invalid PAYMENT-REQUIRED body");
  }
  return {
    error: obj.error,
    accepts: obj.accepts.map((a) => ({
      scheme: String(a.scheme || ""),
      network: a.network != null ? String(a.network) : undefined,
      asset: a.asset != null ? String(a.asset) : undefined,
      amount: a.amount != null ? String(a.amount) : undefined,
      payTo: a.payTo != null ? String(a.payTo) : undefined,
    })),
  };
}

export function pickBatchQuote(accepts: Array<{ scheme: string; amount?: string }>): number {
  const batch = accepts.find((a) => a.scheme === SCHEME_BATCH);
  if (!batch?.amount) throw new Error("no ansem-batch accept in challenge");
  const n = Number(batch.amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error("invalid quote amount");
  return Math.trunc(n);
}
