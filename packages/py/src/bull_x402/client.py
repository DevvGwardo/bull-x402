from __future__ import annotations

import time
from typing import Any

import httpx

from .approve import ensure_approve
from .channel import WalletChannel
from .constants import DEFAULT_BASE_URL
from .info import X402Info, load_info
from .keypair import AgentKeypair
from .voucher import (
    build_payment_payload,
    decode_payment_required,
    encode_payment_signature,
    pick_batch_quote,
)


class _Completions:
    def __init__(self, client: "PaidClient") -> None:
        self._client = client

    def create(self, **kwargs: Any) -> Any:
        return self._client._json(self._client._paid_post("/chat/completions", kwargs))


class _Chat:
    def __init__(self, client: "PaidClient") -> None:
        self.completions = _Completions(client)


class _Embeddings:
    def __init__(self, client: "PaidClient") -> None:
        self._client = client

    def create(self, **kwargs: Any) -> Any:
        return self._client._json(self._client._paid_post("/embeddings", kwargs))


class _Images:
    def __init__(self, client: "PaidClient") -> None:
        self._client = client

    def generate(self, **kwargs: Any) -> Any:
        return self._client._json(self._client._paid_post("/images/generations", kwargs))


class PaidClient:
    def __init__(
        self,
        *,
        keypair: AgentKeypair,
        base_url: str = DEFAULT_BASE_URL,
        rpc_url: str | None = None,
        channel: WalletChannel | None = None,
        approve_buffer_ansem: float | None = None,
        auto_approve: bool = True,
        http: httpx.Client | None = None,
    ) -> None:
        self.keypair = keypair
        self.base_url = base_url
        self.rpc_url = rpc_url
        self.channel = channel or WalletChannel()
        self.approve_buffer_ansem = approve_buffer_ansem
        self.auto_approve = auto_approve
        self._http = http
        self._owns_http = http is None
        self._info: X402Info | None = None
        self.chat = _Chat(self)
        self.embeddings = _Embeddings(self)
        self.images = _Images(self)

    def _root(self) -> str:
        return self.base_url.rstrip("/").removesuffix("/v1")

    def _v1(self) -> str:
        return f"{self._root()}/v1"

    def _client(self) -> httpx.Client:
        if self._http is None:
            self._http = httpx.Client(timeout=120.0)
        return self._http

    def close(self) -> None:
        if self._owns_http and self._http is not None:
            self._http.close()
            self._http = None

    def __enter__(self) -> "PaidClient":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def load_info(self) -> X402Info:
        if self._info is None:
            self._info = load_info(self.base_url, client=self._client())
        return self._info

    def _paid_post(self, path: str, body: dict[str, Any]) -> httpx.Response:
        url = f"{self._v1()}{path}"
        http = self._client()
        res = http.post(url, json=body)
        if res.status_code != 402:
            return res

        accepts = None
        try:
            accepts = res.json().get("accepts")
        except Exception:
            accepts = None
        header = res.headers.get("PAYMENT-REQUIRED") or res.headers.get("payment-required")
        if not accepts and header:
            accepts = decode_payment_required(header).get("accepts")
        if not accepts:
            raise RuntimeError("402 without payment challenge")

        quote = pick_batch_quote(accepts)
        xinfo = self.load_info()
        decimals = int(xinfo.get("decimals") or 6)

        if self.auto_approve:
            cumulative_preview = self.channel.next_cumulative(quote)
            approve_human = max(
                cumulative_preview / (10**decimals),
                float(self.approve_buffer_ansem or 0),
                quote / (10**decimals),
            )
            ensure_approve(
                keypair=self.keypair,
                amount=approve_human,
                rpc_url=self.rpc_url or "https://api.mainnet-beta.solana.com",
                base_url=self.base_url,
                info=xinfo,
            )

        cumulative = self.channel.next_cumulative(quote)
        expiry = int(time.time()) + 600
        payload = build_payment_payload(
            self.keypair,
            network=xinfo["network"],
            pay_to=xinfo["payTo"],
            mint=xinfo["asset"],
            cumulative_micros=cumulative,
            expiry=expiry,
            nonce=self.channel.fresh_nonce(),
        )
        sig = encode_payment_signature(payload)
        res = http.post(url, json=body, headers={"PAYMENT-SIGNATURE": sig})
        if res.is_success:
            self.channel.commit(cumulative)
        return res

    def _json(self, res: httpx.Response) -> Any:
        try:
            data = res.json()
        except Exception:
            data = {"raw": res.text}
        if res.is_error:
            raise RuntimeError(f"HTTP {res.status_code}: {data}")
        return data


def create_paid_client(**kwargs: Any) -> PaidClient:
    return PaidClient(**kwargs)
