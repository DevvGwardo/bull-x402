#!/usr/bin/env python3
"""One-shot example — pip install -e packages/py first."""
from __future__ import annotations

import os
import sys

from bull_x402 import create_paid_client, keypair_from_seed


def main() -> None:
    seed_hex = os.environ.get("BULL_X402_SEED_HEX", "").strip()
    if not seed_hex:
        raise SystemExit("Set BULL_X402_SEED_HEX")
    kp = keypair_from_seed(bytes.fromhex(seed_hex.removeprefix("0x")))
    msg = " ".join(sys.argv[1:]) or "gm"
    with create_paid_client(
        keypair=kp,
        base_url=os.environ.get("BULL_API_BASE", "https://api.bullinf.fun"),
        rpc_url=os.environ.get("SOLANA_RPC_URL"),
    ) as client:
        res = client.chat.completions.create(
            model=os.environ.get("BULL_MODEL", "llama-3.1-8b-instant"),
            messages=[{"role": "user", "content": msg}],
        )
    print(res["choices"][0]["message"]["content"])


if __name__ == "__main__":
    main()
