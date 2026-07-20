import nacl from "tweetnacl";
import bs58 from "bs58";

export type AgentKeypair = {
  /** 32-byte Ed25519 seed */
  secretKey: Uint8Array;
  /** 32-byte public key */
  publicKey: Uint8Array;
  /** base58 pubkey (Solana address / payer) */
  payer: string;
};

export function keypairFromSeed(seed: Uint8Array | Buffer): AgentKeypair {
  const s = Uint8Array.from(seed);
  if (s.length !== 32) throw new Error("seed must be 32 bytes");
  const kp = nacl.sign.keyPair.fromSeed(s);
  return {
    secretKey: s,
    publicKey: kp.publicKey,
    payer: bs58.encode(kp.publicKey),
  };
}

export function keypairFromSecretKey(secret64: Uint8Array): AgentKeypair {
  if (secret64.length !== 64) throw new Error("secret key must be 64 bytes");
  return keypairFromSeed(secret64.slice(0, 32));
}

export function signBytes(seed32: Uint8Array, message: Uint8Array): Uint8Array {
  const kp = nacl.sign.keyPair.fromSeed(seed32);
  return nacl.sign.detached(message, kp.secretKey);
}
