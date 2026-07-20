import { DEFAULT_BASE_URL } from "./constants.js";

export type X402Info = {
  enabled: boolean;
  schemes: string[];
  preferred: string;
  network: string;
  cluster: string;
  asset: string;
  decimals: number;
  currency: string;
  payTo: string;
  settlement_authority?: string;
  domain: string;
  flat_fee_micros: number;
  max_voucher_micros: number;
  settlement?: string;
};

export async function loadInfo(baseUrl: string = DEFAULT_BASE_URL): Promise<X402Info> {
  const root = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  const url = `${root}/x402/info`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`x402/info failed: ${res.status}`);
  return (await res.json()) as X402Info;
}
