import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { keypairFromSeed } from "../src/keypair.js";
import {
  voucherMessage,
  signVoucher,
  buildPaymentPayload,
  encodePaymentSignature,
} from "../src/voucher.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fixture = JSON.parse(
  readFileSync(join(root, "fixtures", "vouchers.json"), "utf8"),
) as {
  seed_hex: string;
  payer: string;
  message_utf8: string;
  signature_b58: string;
  payload: Record<string, unknown>;
  payment_signature_header: string;
};

describe("golden voucher vectors", () => {
  const seed = Buffer.from(fixture.seed_hex, "hex");
  const kp = keypairFromSeed(seed);

  test("payer matches fixture", () => {
    expect(kp.payer).toBe(fixture.payer);
  });

  test("message matches fixture", () => {
    const msg = voucherMessage({
      channelId: fixture.payer,
      payer: fixture.payer,
      payTo: String(fixture.payload.payTo),
      mint: String(fixture.payload.asset),
      cumulativeMicros: Number(fixture.payload.cumulativeMicros),
      expiry: Number(fixture.payload.expiry),
      nonce: String(fixture.payload.nonce),
    });
    expect(new TextDecoder().decode(msg)).toBe(fixture.message_utf8);
  });

  test("signature matches fixture", () => {
    const sig = signVoucher(kp, {
      payTo: String(fixture.payload.payTo),
      mint: String(fixture.payload.asset),
      cumulativeMicros: Number(fixture.payload.cumulativeMicros),
      expiry: Number(fixture.payload.expiry),
      nonce: String(fixture.payload.nonce),
    });
    expect(sig).toBe(fixture.signature_b58);
  });

  test("PAYMENT-SIGNATURE header matches fixture", () => {
    const payload = buildPaymentPayload(kp, {
      network: String(fixture.payload.network),
      payTo: String(fixture.payload.payTo),
      mint: String(fixture.payload.asset),
      cumulativeMicros: Number(fixture.payload.cumulativeMicros),
      expiry: Number(fixture.payload.expiry),
      nonce: String(fixture.payload.nonce),
    });
    expect(encodePaymentSignature(payload)).toBe(fixture.payment_signature_header);
  });
});
