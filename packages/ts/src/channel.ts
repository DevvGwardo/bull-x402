import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type ChannelState = {
  authorizedMicros: number;
};

export class WalletChannel {
  authorizedMicros = 0;
  private path?: string;

  constructor(opts?: { path?: string; authorizedMicros?: number }) {
    this.path = opts?.path;
    if (opts?.authorizedMicros != null) {
      this.authorizedMicros = Math.max(0, Math.trunc(opts.authorizedMicros));
    } else if (this.path && existsSync(this.path)) {
      const raw = JSON.parse(readFileSync(this.path, "utf8")) as ChannelState;
      this.authorizedMicros = Math.max(0, Math.trunc(raw.authorizedMicros || 0));
    }
  }

  /** Next cumulative authorization covering `quoteMicros` more spend. */
  nextCumulative(quoteMicros: number): number {
    const q = Math.max(1, Math.trunc(quoteMicros));
    return this.authorizedMicros + q;
  }

  commit(cumulativeMicros: number): void {
    const c = Math.trunc(cumulativeMicros);
    if (c > this.authorizedMicros) {
      this.authorizedMicros = c;
      this.persist();
    }
  }

  freshNonce(): string {
    return randomBytes(16).toString("hex");
  }

  private persist(): void {
    if (!this.path) return;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(
      this.path,
      JSON.stringify({ authorizedMicros: this.authorizedMicros }, null, 2),
      "utf8",
    );
  }
}
