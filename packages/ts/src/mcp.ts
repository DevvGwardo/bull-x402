#!/usr/bin/env node
/**
 * Minimal MCP server: bull_chat, bull_approve, bull_balance_hint.
 * Requires @modelcontextprotocol/sdk (optionalDependency).
 */
import { readFileSync, existsSync } from "node:fs";
import {
  keypairFromSeed,
  keypairFromSecretKey,
  createPaidClient,
  ensureApprove,
  readBalanceHint,
  loadInfo,
  type AgentKeypair,
} from "./index.js";

function loadKeypair(): AgentKeypair {
  const path = process.env.BULL_X402_KEYPAIR || process.env.BULL_X402_SECRET;
  const seedHex = process.env.BULL_X402_SEED_HEX;
  if (seedHex) {
    const buf = Buffer.from(seedHex.replace(/^0x/, ""), "hex");
    if (buf.length !== 32) throw new Error("BULL_X402_SEED_HEX must be 32 bytes hex");
    return keypairFromSeed(buf);
  }
  if (!path || !existsSync(path)) {
    throw new Error("Set BULL_X402_KEYPAIR (json byte array) or BULL_X402_SEED_HEX");
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as number[];
  const secret = Uint8Array.from(raw);
  if (secret.length === 32) return keypairFromSeed(secret);
  if (secret.length === 64) return keypairFromSecretKey(secret);
  throw new Error("keypair file must be 32-byte seed or 64-byte secret key JSON array");
}

async function main() {
  let Server: typeof import("@modelcontextprotocol/sdk/server/index.js").Server;
  let StdioServerTransport: typeof import("@modelcontextprotocol/sdk/server/stdio.js").StdioServerTransport;
  let CallToolRequestSchema: typeof import("@modelcontextprotocol/sdk/types.js").CallToolRequestSchema;
  let ListToolsRequestSchema: typeof import("@modelcontextprotocol/sdk/types.js").ListToolsRequestSchema;
  try {
    ({ Server } = await import("@modelcontextprotocol/sdk/server/index.js"));
    ({ StdioServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/stdio.js"
    ));
    ({ CallToolRequestSchema, ListToolsRequestSchema } = await import(
      "@modelcontextprotocol/sdk/types.js"
    ));
  } catch {
    console.error(
      "Install @modelcontextprotocol/sdk to run bull-x402-mcp: npm i @modelcontextprotocol/sdk",
    );
    process.exit(1);
  }

  const baseUrl = process.env.BULL_API_BASE || "https://api.bullinf.fun";
  const rpcUrl = process.env.SOLANA_RPC_URL;
  const keypair = loadKeypair();
  const client = createPaidClient({ keypair, baseUrl, rpcUrl });

  const server = new Server(
    { name: "bull-x402", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "bull_chat",
        description:
          "Chat completion via Bull.inf paid with $ANSEM x402 vouchers (no inf_ key).",
        inputSchema: {
          type: "object",
          properties: {
            model: { type: "string" },
            message: { type: "string" },
          },
          required: ["message"],
        },
      },
      {
        name: "bull_approve",
        description: "SPL-Approve treasury for $ANSEM spending (idempotent).",
        inputSchema: {
          type: "object",
          properties: {
            amount: { type: "number", description: "Human ANSEM amount" },
          },
          required: ["amount"],
        },
      },
      {
        name: "bull_balance_hint",
        description: "Read $ANSEM balance/allowance + x402 info payTo/mint.",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    const args = (req.params.arguments || {}) as Record<string, unknown>;
    try {
      if (name === "bull_chat") {
        const model =
          (args.model as string) ||
          process.env.BULL_MODEL ||
          "llama-3.1-8b-instant";
        const message = String(args.message || "");
        const res = (await client.chat.completions.create({
          model,
          messages: [{ role: "user", content: message }],
        })) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = res.choices?.[0]?.message?.content ?? JSON.stringify(res);
        return { content: [{ type: "text", text }] };
      }
      if (name === "bull_approve") {
        const amount = Number(args.amount);
        const sig = await ensureApprove({
          keypair,
          amount,
          baseUrl,
          rpcUrl,
        });
        return {
          content: [
            {
              type: "text",
              text: sig ? `approved tx=${sig}` : "allowance already sufficient",
            },
          ],
        };
      }
      if (name === "bull_balance_hint") {
        const info = await loadInfo(baseUrl);
        const bal = await readBalanceHint({ keypair, baseUrl, rpcUrl, info });
        return {
          content: [{ type: "text", text: JSON.stringify({ info, bal }, null, 2) }],
        };
      }
      return { content: [{ type: "text", text: `unknown tool ${name}` }], isError: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
