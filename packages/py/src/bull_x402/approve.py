from __future__ import annotations

from typing import Any

import httpx
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.instruction import AccountMeta, Instruction
from solders.hash import Hash
from solders.message import Message
from solders.transaction import Transaction

from .constants import DEFAULT_BASE_URL
from .info import X402Info, load_info
from .keypair import AgentKeypair

TOKEN_PROGRAM_ID = Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
TOKEN_2022_PROGRAM_ID = Pubkey.from_string("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
ASSOCIATED_TOKEN_PROGRAM_ID = Pubkey.from_string(
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
)
SYSTEM_PROGRAM_ID = Pubkey.from_string("11111111111111111111111111111111")

DEFAULT_RPC = "https://api.mainnet-beta.solana.com"


def _rpc(rpc_url: str, method: str, params: list[Any]) -> Any:
    with httpx.Client(timeout=60.0) as client:
        r = client.post(
            rpc_url,
            json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        )
        r.raise_for_status()
        body = r.json()
        if "error" in body:
            raise RuntimeError(body["error"])
        return body.get("result")


def _to_solders_kp(agent: AgentKeypair) -> Keypair:
    return Keypair.from_seed(agent.secret_key)


def _find_ata(owner: Pubkey, mint: Pubkey, token_program: Pubkey) -> Pubkey:
    ata, _ = Pubkey.find_program_address(
        [bytes(owner), bytes(token_program), bytes(mint)],
        ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    return ata


def _create_ata_ix(
    payer: Pubkey, owner: Pubkey, mint: Pubkey, token_program: Pubkey
) -> Instruction:
    ata = _find_ata(owner, mint, token_program)
    return Instruction(
        ASSOCIATED_TOKEN_PROGRAM_ID,
        bytes([1]),  # CreateIdempotent
        [
            AccountMeta(payer, True, True),
            AccountMeta(ata, False, True),
            AccountMeta(owner, False, False),
            AccountMeta(mint, False, False),
            AccountMeta(SYSTEM_PROGRAM_ID, False, False),
            AccountMeta(token_program, False, False),
        ],
    )


def _approve_ix(
    source: Pubkey,
    delegate: Pubkey,
    owner: Pubkey,
    amount: int,
    token_program: Pubkey,
) -> Instruction:
    data = bytes([4]) + int(amount).to_bytes(8, "little")
    return Instruction(
        token_program,
        data,
        [
            AccountMeta(source, False, True),
            AccountMeta(delegate, False, False),
            AccountMeta(owner, True, False),
        ],
    )


def _resolve_token_program(rpc_url: str, mint: Pubkey) -> Pubkey:
    info = _rpc(rpc_url, "getAccountInfo", [str(mint), {"encoding": "base64"}])
    if not info or not info.get("value"):
        raise RuntimeError(f"mint account not found: {mint}")
    owner = info["value"]["owner"]
    if owner == str(TOKEN_2022_PROGRAM_ID):
        return TOKEN_2022_PROGRAM_ID
    return TOKEN_PROGRAM_ID


def _parse_token_account(data: bytes) -> tuple[int, Pubkey | None, int]:
    amount = int.from_bytes(data[64:72], "little")
    delegate_option = int.from_bytes(data[72:76], "little")
    if delegate_option == 1:
        delegate = Pubkey.from_bytes(data[76:108])
        delegated_amount = int.from_bytes(data[121:129], "little")
        return amount, delegate, delegated_amount
    return amount, None, 0


def ensure_approve(
    *,
    keypair: AgentKeypair,
    amount: float,
    rpc_url: str = DEFAULT_RPC,
    base_url: str = DEFAULT_BASE_URL,
    info: X402Info | None = None,
) -> str | None:
    """Idempotent SPL Approve. Returns tx signature or None if already sufficient."""
    import base64

    xinfo = info or load_info(base_url)
    pay_to = xinfo.get("payTo") or ""
    asset = xinfo.get("asset") or ""
    if not pay_to or not asset:
        raise RuntimeError("x402/info missing payTo/asset")
    decimals = int(xinfo.get("decimals") or 6)
    raw_need = int(amount * (10**decimals))
    if raw_need <= 0:
        raise ValueError("amount must be > 0")

    mint = Pubkey.from_string(asset)
    delegate = Pubkey.from_string(pay_to)
    owner_kp = _to_solders_kp(keypair)
    owner = owner_kp.pubkey()
    program = _resolve_token_program(rpc_url, mint)
    ata = _find_ata(owner, mint, program)

    ata_info = _rpc(rpc_url, "getAccountInfo", [str(ata), {"encoding": "base64"}])
    if ata_info and ata_info.get("value"):
        raw_b64 = ata_info["value"]["data"][0]
        data = base64.b64decode(raw_b64)
        _bal, deleg, delegated = _parse_token_account(data)
        if deleg == delegate and delegated >= raw_need:
            return None

    ixs: list[Instruction] = []
    if not (ata_info and ata_info.get("value")):
        ixs.append(_create_ata_ix(owner, owner, mint, program))
    ixs.append(_approve_ix(ata, delegate, owner, raw_need, program))

    bh_res = _rpc(rpc_url, "getLatestBlockhash", [{"commitment": "confirmed"}])
    blockhash = Hash.from_string(bh_res["value"]["blockhash"])
    msg = Message.new_with_blockhash(ixs, owner, blockhash)
    tx = Transaction.new_unsigned(msg)
    tx.sign([owner_kp], blockhash)
    raw = bytes(tx)
    sig = _rpc(
        rpc_url,
        "sendTransaction",
        [
            base64.b64encode(raw).decode(),
            {"encoding": "base64", "preflightCommitment": "confirmed"},
        ],
    )
    return str(sig)


def read_balance_hint(
    *,
    keypair: AgentKeypair,
    rpc_url: str = DEFAULT_RPC,
    base_url: str = DEFAULT_BASE_URL,
    info: X402Info | None = None,
) -> dict[str, Any]:
    import base64

    xinfo = info or load_info(base_url)
    mint = Pubkey.from_string(xinfo["asset"])
    owner = Pubkey.from_string(keypair.payer)
    program = _resolve_token_program(rpc_url, mint)
    ata = _find_ata(owner, mint, program)
    balance_raw = 0
    allowance_raw = 0
    ata_info = _rpc(rpc_url, "getAccountInfo", [str(ata), {"encoding": "base64"}])
    if ata_info and ata_info.get("value"):
        data = base64.b64decode(ata_info["value"]["data"][0])
        bal, deleg, delegated = _parse_token_account(data)
        balance_raw = bal
        if deleg == Pubkey.from_string(xinfo["payTo"]):
            allowance_raw = delegated
    return {
        "payer": keypair.payer,
        "payTo": xinfo["payTo"],
        "mint": xinfo["asset"],
        "balanceRaw": str(balance_raw),
        "allowanceRaw": str(allowance_raw),
        "decimals": int(xinfo.get("decimals") or 6),
    }
