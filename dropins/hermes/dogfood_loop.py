#!/usr/bin/env python3
"""Simple dogfood loop: N paid chat completions via x402."""
from __future__ import annotations

import os
import sys
import time

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from chat_once import load_kp  # noqa: E402
from bull_x402 import create_paid_client  # noqa: E402


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    model = os.environ.get("BULL_MODEL", "llama-3.1-8b-instant")
    base = os.environ.get("BULL_API_BASE", "https://api.bullinf.fun")
    rpc = os.environ.get("SOLANA_RPC_URL")
    kp = load_kp()
    ok = 0
    with create_paid_client(keypair=kp, base_url=base, rpc_url=rpc) as client:
        for i in range(n):
            try:
                res = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": f"ping {i}"}],
                )
                text = res["choices"][0]["message"]["content"]
                print(f"[{i+1}/{n}] ok: {text[:80]!r}")
                ok += 1
            except Exception as e:
                print(f"[{i+1}/{n}] fail: {e}")
            time.sleep(0.5)
    print(f"done {ok}/{n}")


if __name__ == "__main__":
    main()
