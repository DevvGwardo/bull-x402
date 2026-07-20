from __future__ import annotations

import base64
import json
import re
from typing import Any

import base58

from .constants import DOMAIN, SCHEME_BATCH
from .keypair import AgentKeypair

_ASCII = re.compile(r"^[\x20-\x7E]+$")


def voucher_message(
    *,
    channel_id: str,
    payer: str,
    pay_to: str,
    mint: str,
    cumulative_micros: int,
    expiry: int,
    nonce: str,
) -> bytes:
    parts = [
        DOMAIN,
        channel_id,
        payer,
        pay_to,
        mint,
        str(int(cumulative_micros)),
        str(int(expiry)),
        nonce,
    ]
    for p in parts:
        if not isinstance(p, str) or not _ASCII.match(p):
            raise ValueError("voucher fields must be printable ASCII")
    return "|".join(parts).encode("ascii")


def sign_voucher(
    keypair: AgentKeypair,
    *,
    pay_to: str,
    mint: str,
    cumulative_micros: int,
    expiry: int,
    nonce: str,
    payer: str | None = None,
    channel_id: str | None = None,
) -> str:
    payer_s = payer or keypair.payer
    channel = channel_id or payer_s
    if channel != payer_s:
        raise ValueError("channelId must equal payer")
    msg = voucher_message(
        channel_id=channel,
        payer=payer_s,
        pay_to=pay_to,
        mint=mint,
        cumulative_micros=cumulative_micros,
        expiry=expiry,
        nonce=nonce,
    )
    sig = keypair.private.sign(msg)
    return base58.b58encode(sig).decode()


def build_payment_payload(
    keypair: AgentKeypair,
    *,
    network: str,
    pay_to: str,
    mint: str,
    cumulative_micros: int,
    expiry: int,
    nonce: str,
) -> dict[str, Any]:
    payer = keypair.payer
    signature = sign_voucher(
        keypair,
        pay_to=pay_to,
        mint=mint,
        cumulative_micros=cumulative_micros,
        expiry=expiry,
        nonce=nonce,
        payer=payer,
        channel_id=payer,
    )
    return {
        "scheme": SCHEME_BATCH,
        "network": network,
        "asset": mint,
        "payTo": pay_to,
        "payer": payer,
        "channelId": payer,
        "cumulativeMicros": int(cumulative_micros),
        "expiry": int(expiry),
        "nonce": nonce,
        "signature": signature,
    }


def encode_payment_signature(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.b64encode(raw).decode()


def decode_payment_required(header: str) -> dict[str, Any]:
    data = base64.b64decode(header.strip(), validate=True)
    obj = json.loads(data.decode("utf-8"))
    if not isinstance(obj, dict) or not isinstance(obj.get("accepts"), list):
        raise ValueError("invalid PAYMENT-REQUIRED body")
    return obj


def pick_batch_quote(accepts: list[dict[str, Any]]) -> int:
    batch = next((a for a in accepts if a.get("scheme") == SCHEME_BATCH), None)
    if not batch or batch.get("amount") is None:
        raise ValueError("no ansem-batch accept in challenge")
    n = int(batch["amount"])
    if n <= 0:
        raise ValueError("invalid quote amount")
    return n
