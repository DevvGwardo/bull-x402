import { DEFAULT_BASE_URL } from "./constants.js";
import type { AgentKeypair } from "./keypair.js";
import { WalletChannel } from "./channel.js";
import { loadInfo, type X402Info } from "./info.js";
import { ensureApprove } from "./approve.js";
import {
  buildPaymentPayload,
  decodePaymentRequired,
  encodePaymentSignature,
  pickBatchQuote,
} from "./voucher.js";

export type PaidClientOptions = {
  keypair: AgentKeypair;
  baseUrl?: string;
  rpcUrl?: string;
  channel?: WalletChannel;
  /** Human ANSEM to Approve when allowance is low (default: cover quote + buffer). */
  approveBufferAnsem?: number;
  fetchImpl?: typeof fetch;
  /** Auto Approve on first 402 (default true). */
  autoApprove?: boolean;
};

export type ChatCompletionRequest = {
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  [key: string]: unknown;
};

function apiRoot(baseUrl: string): string {
  const u = baseUrl.replace(/\/+$/, "");
  return u.endsWith("/v1") ? u.slice(0, -3) : u;
}

function v1Base(baseUrl: string): string {
  const root = apiRoot(baseUrl);
  return `${root}/v1`;
}

export function createPaidClient(opts: PaidClientOptions) {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const channel = opts.channel ?? new WalletChannel();
  const fetchFn = opts.fetchImpl ?? fetch;
  const autoApprove = opts.autoApprove !== false;
  let cachedInfo: X402Info | null = null;

  async function info(): Promise<X402Info> {
    if (!cachedInfo) cachedInfo = await loadInfo(baseUrl);
    return cachedInfo;
  }

  async function paidPost(path: string, body: unknown): Promise<Response> {
    const url = `${v1Base(baseUrl)}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    let res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (res.status !== 402) return res;

    const paymentRequired =
      res.headers.get("PAYMENT-REQUIRED") || res.headers.get("payment-required");
    let challengeBody: { accepts?: Array<{ scheme: string; amount?: string }> } =
      {};
    try {
      challengeBody = (await res.clone().json()) as typeof challengeBody;
    } catch {
      /* header-only */
    }

    let accepts = challengeBody.accepts;
    if ((!accepts || !accepts.length) && paymentRequired) {
      accepts = decodePaymentRequired(paymentRequired).accepts;
    }
    if (!accepts?.length) throw new Error("402 without payment challenge");

    const quote = pickBatchQuote(accepts);
    const xinfo = await info();
    if (autoApprove) {
      const decimals = xinfo.decimals ?? 6;
      const human =
        opts.approveBufferAnsem ??
        Math.max(quote / 10 ** decimals, quote / 10 ** decimals);
      // Approve at least the cumulative head we are about to authorize
      const cumulativePreview = channel.nextCumulative(quote);
      const approveHuman = Math.max(
        human,
        cumulativePreview / 10 ** decimals,
        opts.approveBufferAnsem ?? 0,
      );
      await ensureApprove({
        keypair: opts.keypair,
        amount: approveHuman,
        rpcUrl: opts.rpcUrl,
        baseUrl,
        info: xinfo,
      });
    }

    const cumulative = channel.nextCumulative(quote);
    const expiry = Math.floor(Date.now() / 1000) + 600;
    const payload = buildPaymentPayload(opts.keypair, {
      network: xinfo.network,
      payTo: xinfo.payTo,
      mint: xinfo.asset,
      cumulativeMicros: cumulative,
      expiry,
      nonce: channel.freshNonce(),
    });
    const sigHeader = encodePaymentSignature(payload);

    res = await fetchFn(url, {
      method: "POST",
      headers: {
        ...headers,
        "PAYMENT-SIGNATURE": sigHeader,
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      channel.commit(cumulative);
    }
    return res;
  }

  async function jsonOrThrow(res: Response): Promise<unknown> {
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`) as Error & {
        status: number;
        body: unknown;
      };
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  return {
    channel,
    loadInfo: info,
    chat: {
      completions: {
        create: async (req: ChatCompletionRequest) => {
          const res = await paidPost("/chat/completions", req);
          return jsonOrThrow(res);
        },
      },
    },
    embeddings: {
      create: async (req: Record<string, unknown>) => {
        const res = await paidPost("/embeddings", req);
        return jsonOrThrow(res);
      },
    },
    images: {
      generate: async (req: Record<string, unknown>) => {
        const res = await paidPost("/images/generations", req);
        return jsonOrThrow(res);
      },
    },
    /** Low-level paid POST under /v1 */
    request: paidPost,
  };
}

export type PaidClient = ReturnType<typeof createPaidClient>;
