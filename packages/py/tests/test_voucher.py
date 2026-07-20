from __future__ import annotations

import json
from pathlib import Path

from bull_x402 import (
    build_payment_payload,
    encode_payment_signature,
    keypair_from_seed,
    sign_voucher,
    voucher_message,
)

ROOT = Path(__file__).resolve().parents[3]
FIXTURE = json.loads((ROOT / "fixtures" / "vouchers.json").read_text())


def test_golden_payer():
    seed = bytes.fromhex(FIXTURE["seed_hex"])
    kp = keypair_from_seed(seed)
    assert kp.payer == FIXTURE["payer"]


def test_golden_message():
    seed = bytes.fromhex(FIXTURE["seed_hex"])
    kp = keypair_from_seed(seed)
    payload = FIXTURE["payload"]
    msg = voucher_message(
        channel_id=kp.payer,
        payer=kp.payer,
        pay_to=payload["payTo"],
        mint=payload["asset"],
        cumulative_micros=payload["cumulativeMicros"],
        expiry=payload["expiry"],
        nonce=payload["nonce"],
    )
    assert msg.decode("ascii") == FIXTURE["message_utf8"]


def test_golden_signature():
    seed = bytes.fromhex(FIXTURE["seed_hex"])
    kp = keypair_from_seed(seed)
    payload = FIXTURE["payload"]
    sig = sign_voucher(
        kp,
        pay_to=payload["payTo"],
        mint=payload["asset"],
        cumulative_micros=payload["cumulativeMicros"],
        expiry=payload["expiry"],
        nonce=payload["nonce"],
    )
    assert sig == FIXTURE["signature_b58"]


def test_golden_payment_header():
    seed = bytes.fromhex(FIXTURE["seed_hex"])
    kp = keypair_from_seed(seed)
    payload = FIXTURE["payload"]
    built = build_payment_payload(
        kp,
        network=payload["network"],
        pay_to=payload["payTo"],
        mint=payload["asset"],
        cumulative_micros=payload["cumulativeMicros"],
        expiry=payload["expiry"],
        nonce=payload["nonce"],
    )
    assert encode_payment_signature(built) == FIXTURE["payment_signature_header"]
