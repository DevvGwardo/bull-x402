#!/usr/bin/env python3
"""One-shot Bull.inf x402 chat for Hermes / CLI."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from bull_x402 import create_paid_client, keypair_from_seed, keypair_from_secret_key


def load_kp():
    seed_hex = os.environ.get("BULL_X402_SEED_HEX", "").strip()
    if seed_hex:
        return keypair_from_seed(bytes.fromhex(seed_hex.removeprefix("0x")))
    path = os.environ.get("BULL_X402_KEYPAIR", "").strip()
    if not path:
        raise SystemExit("Set BULL_X402_SEED_HEX or BULL_X402_KEYPAIR")
    raw = json.loads(Path(path).read_text())
    secret = bytes(raw)
    if len(secret) == 32:
        return keypair_from_seed(secret)
    if len(secret) == 64:
        return keypair_from_secret_key(secret)
    raise SystemExit("keypair must be 32 or 64 bytes")


def main() -> None:
    msg = " ".join(sys.argv[1:]) or "gm"
    model = os.environ.get("BULL_MODEL", "llama-3.1-8b-instant")
    base = os.environ.get("BULL_API_BASE", "https://api.bullinf.fun")
    rpc = os.environ.get("SOLANA_RPC_URL")
    kp = load_kp()
    with create_paid_client(keypair=kp, base_url=base, rpc_url=rpc) as client:
        res = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": msg}],
        )
    print(res["choices"][0]["message"]["content"])


if __name__ == "__main__":
    main()
