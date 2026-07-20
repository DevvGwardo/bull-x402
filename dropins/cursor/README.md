# Cursor drop-in

Bull.inf x402 vouchers need a Solana keypair signer. Cursor’s OpenAI-compatible settings cannot sign vouchers directly.

## Path A — `inf_` key (simplest for interactive Cursor)

1. Mint a key on https://bullinf.fun/key
2. Settings → Models → OpenAI Compatible
   - Base URL: `https://api.bullinf.fun/v1`
   - API key: your `inf_…`

## Path B — x402 via MCP (agents that pay themselves)

1. Fund a Solana wallet with `$ANSEM` + a little SOL
2. Export keypair JSON (64-byte secret) to a file, or set `BULL_X402_SEED_HEX`
3. Install and run the MCP from this repo:

```bash
cd packages/ts && npm i && npm run build
# Cursor MCP config example:
```

```json
{
  "mcpServers": {
    "bull-x402": {
      "command": "node",
      "args": ["/ABS/PATH/to/bull-x402/packages/ts/dist/mcp.js"],
      "env": {
        "BULL_X402_SEED_HEX": "YOUR_32_BYTE_SEED_HEX",
        "BULL_API_BASE": "https://api.bullinf.fun",
        "BULL_MODEL": "llama-3.1-8b-instant",
        "SOLANA_RPC_URL": "https://api.mainnet-beta.solana.com"
      }
    }
  }
}
```

Tools: `bull_chat`, `bull_approve`, `bull_balance_hint`.

## Path C — local paid OpenAI proxy

Run [`examples/openai-proxy.mjs`](../../examples/openai-proxy.mjs) and point Cursor’s base URL at `http://127.0.0.1:8787/v1` with any dummy API key. The proxy injects `PAYMENT-SIGNATURE` on 402.
