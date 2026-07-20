from __future__ import annotations

from typing import Any, TypedDict

import httpx

from .constants import DEFAULT_BASE_URL


class X402Info(TypedDict, total=False):
    enabled: bool
    schemes: list[str]
    preferred: str
    network: str
    cluster: str
    asset: str
    decimals: int
    currency: str
    payTo: str
    settlement_authority: str
    domain: str
    flat_fee_micros: int
    max_voucher_micros: int
    settlement: str


def load_info(base_url: str = DEFAULT_BASE_URL, *, client: httpx.Client | None = None) -> X402Info:
    root = base_url.rstrip("/").removesuffix("/v1")
    url = f"{root}/x402/info"
    if client is not None:
        r = client.get(url)
        r.raise_for_status()
        return r.json()  # type: ignore[return-value]
    with httpx.Client(timeout=30.0) as c:
        r = c.get(url)
        r.raise_for_status()
        return r.json()  # type: ignore[return-value]
