/**
 * One-shot paid chat (build packages/ts first: npm run build).
 * Env: BULL_X402_SEED_HEX, BULL_API_BASE, BULL_MODEL
 */
import { keypairFromSeed, createPaidClient } from "../packages/ts/dist/index.js";

const seedHex = process.env.BULL_X402_SEED_HEX;
if (!seedHex) {
  console.error("Set BULL_X402_SEED_HEX");
  process.exit(1);
}
const keypair = keypairFromSeed(Buffer.from(seedHex.replace(/^0x/, ""), "hex"));
const client = createPaidClient({
  keypair,
  baseUrl: process.env.BULL_API_BASE || "https://api.bullinf.fun",
  rpcUrl: process.env.SOLANA_RPC_URL,
});
const res = await client.chat.completions.create({
  model: process.env.BULL_MODEL || "llama-3.1-8b-instant",
  messages: [{ role: "user", content: process.argv.slice(2).join(" ") || "gm" }],
});
console.log(res.choices?.[0]?.message?.content ?? res);
