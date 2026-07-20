import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createApproveInstruction,
  getAccount,
  getMint,
} from "@solana/spl-token";
import type { AgentKeypair } from "./keypair.js";
import { loadInfo, type X402Info } from "./info.js";
import { DEFAULT_BASE_URL } from "./constants.js";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";

function toSolanaKeypair(agent: AgentKeypair): Keypair {
  const secret = new Uint8Array(64);
  secret.set(agent.secretKey, 0);
  secret.set(agent.publicKey, 32);
  return Keypair.fromSecretKey(secret);
}

async function resolveTokenProgram(
  connection: Connection,
  mint: PublicKey,
): Promise<PublicKey> {
  const acc = await connection.getAccountInfo(mint);
  if (!acc) throw new Error(`mint account not found: ${mint.toBase58()}`);
  if (acc.owner.equals(TOKEN_2022_PROGRAM_ID)) return TOKEN_2022_PROGRAM_ID;
  return TOKEN_PROGRAM_ID;
}

export type EnsureApproveOpts = {
  keypair: AgentKeypair;
  /** Human ANSEM amount (decimals from info, default 6). */
  amount: number;
  rpcUrl?: string;
  baseUrl?: string;
  info?: X402Info;
};

/**
 * Idempotent SPL Approve: if allowance already ≥ amount, no-op.
 * Returns Solana tx signature or null when already approved.
 */
export async function ensureApprove(opts: EnsureApproveOpts): Promise<string | null> {
  const info = opts.info ?? (await loadInfo(opts.baseUrl ?? DEFAULT_BASE_URL));
  if (!info.payTo || !info.asset) throw new Error("x402/info missing payTo/asset");
  const connection = new Connection(opts.rpcUrl ?? DEFAULT_RPC, "confirmed");
  const owner = toSolanaKeypair(opts.keypair);
  const mint = new PublicKey(info.asset);
  const delegate = new PublicKey(info.payTo);
  const decimals = info.decimals ?? 6;
  const rawNeed = BigInt(Math.ceil(opts.amount * 10 ** decimals));

  const programId = await resolveTokenProgram(connection, mint);
  const ata = getAssociatedTokenAddressSync(mint, owner.publicKey, false, programId);

  let ataExists = true;
  try {
    const acct = await getAccount(connection, ata, undefined, programId);
    if (acct.delegatedAmount >= rawNeed && acct.delegate?.equals(delegate)) {
      return null;
    }
  } catch {
    ataExists = false;
  }

  const mintInfo = await getMint(connection, mint, undefined, programId);
  if (mintInfo.decimals !== decimals) {
    // Prefer on-chain decimals for the Approve amount
  }
  const raw = BigInt(Math.ceil(opts.amount * 10 ** mintInfo.decimals));

  const tx = new Transaction();
  if (!ataExists) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        owner.publicKey,
        ata,
        owner.publicKey,
        mint,
        programId,
      ),
    );
  }
  tx.add(
    createApproveInstruction(ata, delegate, owner.publicKey, raw, [], programId),
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [owner], {
    commitment: "confirmed",
  });
  return sig;
}

export async function readBalanceHint(opts: {
  keypair: AgentKeypair;
  rpcUrl?: string;
  baseUrl?: string;
  info?: X402Info;
}): Promise<{
  payer: string;
  payTo: string;
  mint: string;
  balanceRaw: string;
  allowanceRaw: string;
  decimals: number;
}> {
  const info = opts.info ?? (await loadInfo(opts.baseUrl ?? DEFAULT_BASE_URL));
  const connection = new Connection(opts.rpcUrl ?? DEFAULT_RPC, "confirmed");
  const mint = new PublicKey(info.asset);
  const owner = new PublicKey(opts.keypair.payer);
  const programId = await resolveTokenProgram(connection, mint);
  const ata = getAssociatedTokenAddressSync(mint, owner, false, programId);
  let balanceRaw = 0n;
  let allowanceRaw = 0n;
  try {
    const acct = await getAccount(connection, ata, undefined, programId);
    balanceRaw = acct.amount;
    if (acct.delegate?.equals(new PublicKey(info.payTo))) {
      allowanceRaw = acct.delegatedAmount;
    }
  } catch {
    // no ATA
  }
  const mintInfo = await getMint(connection, mint, undefined, programId);
  return {
    payer: opts.keypair.payer,
    payTo: info.payTo,
    mint: info.asset,
    balanceRaw: balanceRaw.toString(),
    allowanceRaw: allowanceRaw.toString(),
    decimals: mintInfo.decimals,
  };
}
