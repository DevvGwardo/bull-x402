"""Bull.inf x402 agent wallet kit."""

from .constants import DEFAULT_BASE_URL, DOMAIN, MAINNET_CAIP2, SCHEME_BATCH
from .keypair import AgentKeypair, keypair_from_secret_key, keypair_from_seed
from .voucher import (
    build_payment_payload,
    decode_payment_required,
    encode_payment_signature,
    pick_batch_quote,
    sign_voucher,
    voucher_message,
)
from .channel import WalletChannel
from .info import X402Info, load_info
from .approve import ensure_approve, read_balance_hint
from .client import PaidClient, create_paid_client

__all__ = [
    "DEFAULT_BASE_URL",
    "DOMAIN",
    "MAINNET_CAIP2",
    "SCHEME_BATCH",
    "AgentKeypair",
    "keypair_from_seed",
    "keypair_from_secret_key",
    "voucher_message",
    "sign_voucher",
    "build_payment_payload",
    "encode_payment_signature",
    "decode_payment_required",
    "pick_batch_quote",
    "WalletChannel",
    "X402Info",
    "load_info",
    "ensure_approve",
    "read_balance_hint",
    "PaidClient",
    "create_paid_client",
]

__version__ = "0.1.0"
