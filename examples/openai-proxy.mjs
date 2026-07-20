#!/usr/bin/env node
/**
 * Local OpenAI-compatible proxy that injects Bull.inf x402 PAYMENT-SIGNATURE.
 * Point Cursor / any client at http://127.0.0.1:8787/v1 with a dummy API key.
 *
 * Env: BULL_X402_SEED_HEX, BULL_API_BASE, SOLANA_RPC_URL, PORT
 */
import { createServer } from "node:http";
import { keypairFromSeed, createPaidClient } from "../packages/ts/dist/index.js";

const port = Number(process.env.PORT || 8787);
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

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/health" || req.url === "/v1/models")) {
      const upstream = await fetch(
        `${(process.env.BULL_API_BASE || "https://api.bullinf.fun").replace(/\/$/, "")}/v1/models`,
      );
      const text = await upstream.text();
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      res.end(text);
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end("method not allowed");
      return;
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    const path = (req.url || "").replace(/^\/v1/, "") || "/chat/completions";
    const upstream = await client.request(path.startsWith("/") ? path : `/${path}`, body);
    const text = await upstream.text();
    res.writeHead(upstream.status, { "Content-Type": "application/json" });
    res.end(text);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(port, () => {
  console.log(`bull-x402 openai proxy on http://127.0.0.1:${port}/v1`);
});
