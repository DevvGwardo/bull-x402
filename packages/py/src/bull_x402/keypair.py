from __future__ import annotations

from dataclasses import dataclass

import base58
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey


@dataclass(frozen=True)
class AgentKeypair:
    secret_key: bytes  # 32-byte seed
    public_key: bytes  # 32-byte raw
    payer: str  # base58

    @property
    def private(self) -> Ed25519PrivateKey:
        return Ed25519PrivateKey.from_private_bytes(self.secret_key)


def keypair_from_seed(seed: bytes) -> AgentKeypair:
    if len(seed) != 32:
        raise ValueError("seed must be 32 bytes")
    sk = Ed25519PrivateKey.from_private_bytes(seed)
    pub = sk.public_key().public_bytes_raw()
    return AgentKeypair(secret_key=seed, public_key=pub, payer=base58.b58encode(pub).decode())


def keypair_from_secret_key(secret64: bytes) -> AgentKeypair:
    if len(secret64) != 64:
        raise ValueError("secret key must be 64 bytes")
    return keypair_from_seed(secret64[:32])
