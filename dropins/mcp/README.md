# MCP server

The MCP entrypoint ships with `@bullinf/x402` as bin `bull-x402-mcp` (source: `packages/ts/src/mcp.js` after build).

## Tools

| Tool | Purpose |
|------|---------|
| `bull_chat` | Paid chat completion (`message`, optional `model`) |
| `bull_approve` | SPL-Approve treasury for human `$ANSEM` amount |
| `bull_balance_hint` | Balance / allowance + `/x402/info` |

## Env

- `BULL_X402_SEED_HEX` or `BULL_X402_KEYPAIR` (JSON byte array)
- `BULL_API_BASE` (default `https://api.bullinf.fun`)
- `BULL_MODEL` (default `llama-3.1-8b-instant`)
- `SOLANA_RPC_URL` (optional)

## Run locally

```bash
cd packages/ts
npm i
npm i @modelcontextprotocol/sdk
npm run build
BULL_X402_SEED_HEX=... node dist/mcp.js
```

See also [../cursor/README.md](../cursor/README.md).
