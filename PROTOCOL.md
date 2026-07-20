# Bull.inf x402 protocol (`ansem-batch`)

Client contract for agents that pay per inference request with **`$ANSEM` on Solana** — no `inf_` API key.

Server verification, channel ledger, treasury, and settle-batch stay on Bull.inf. This document is the **client** surface only.

## Discovery

```http
GET https://api.bullinf.fun/x402/info
```

Returns (among other fields): `enabled`, `preferred` (`ansem-batch`), `network` (CAIP-2), `cluster`, `asset` (mint), `decimals`, `payTo` (treasury), `domain` (`bull.x402.v1`), `max_voucher_micros`.

## Flow

1. Agent `POST /v1/chat/completions` (also embeddings / images) with **no** `Authorization`.
2. Server responds **HTTP 402** with `PAYMENT-REQUIRED` (base64 JSON) listing `accepts[]`.
3. Prefer scheme `ansem-batch`. Read `amount` (ANSEM micros / atomic units) from the matching accept.
4. Once: SPL **Approve** the treasury (`payTo`) as delegate for enough `$ANSEM` (+ SOL for fees).
5. Sign a cumulative Ed25519 voucher; set `PAYMENT-SIGNATURE` (base64 JSON); retry the same request.
6. Server verifies off-chain and serves inference. On-chain pulls happen later via Bull ops (`settle-batch`) — not part of this kit.

## Voucher message

ASCII, `|`-joined:

```text
bull.x402.v1|{channelId}|{payer}|{payTo}|{mint}|{cumulativeMicros}|{expiry}|{nonce}
```

- Domain / first field: `bull.x402.v1`
- v1: `channelId` **must equal** `payer` (payer pubkey, base58)
- `cumulativeMicros`: non-decreasing channel authorization head (integer)
- `expiry`: unix seconds; must be in the future and ≤ now + 7 days
- `nonce`: printable ASCII, ≤ 128 chars
- Sign with the payer’s Ed25519 secret; encode signature as **base58**

## `PAYMENT-SIGNATURE` payload

JSON object, then base64:

| Field | Notes |
|-------|--------|
| `scheme` | `ansem-batch` |
| `network` | CAIP-2 from `/x402/info` |
| `asset` | `$ANSEM` mint |
| `payTo` | treasury pubkey |
| `payer` | agent wallet |
| `channelId` | same as `payer` |
| `cumulativeMicros` | integer |
| `expiry` | unix seconds |
| `nonce` | string |
| `signature` | base58 Ed25519 |

`exact` may appear in challenges for compatibility but is **rejected** without on-chain proof — use `ansem-batch`.

## Client channel state

Track local `authorizedMicros` (last successful cumulative). On each 402:

`nextCumulative = max(authorizedMicros, consumedHint) + quoteAmount`

Bump after a successful paid response so the next voucher is strictly increasing. Optional file persistence for long-running agents.

## Security

- Agent keypair is a **hot wallet**. Approve only what you need.
- This kit never holds treasury keys and never calls settle-batch.
- Do not commit keypairs or seed phrases.
