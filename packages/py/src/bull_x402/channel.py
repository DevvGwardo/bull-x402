from __future__ import annotations

import json
import os
import secrets
from pathlib import Path


class WalletChannel:
    def __init__(
        self,
        *,
        path: str | os.PathLike[str] | None = None,
        authorized_micros: int | None = None,
    ) -> None:
        self.path = Path(path) if path else None
        self.authorized_micros = 0
        if authorized_micros is not None:
            self.authorized_micros = max(0, int(authorized_micros))
        elif self.path and self.path.exists():
            raw = json.loads(self.path.read_text())
            self.authorized_micros = max(0, int(raw.get("authorized_micros") or 0))

    def next_cumulative(self, quote_micros: int) -> int:
        q = max(1, int(quote_micros))
        return self.authorized_micros + q

    def commit(self, cumulative_micros: int) -> None:
        c = int(cumulative_micros)
        if c > self.authorized_micros:
            self.authorized_micros = c
            self._persist()

    def fresh_nonce(self) -> str:
        return secrets.token_hex(16)

    def _persist(self) -> None:
        if not self.path:
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps({"authorized_micros": self.authorized_micros}, indent=2)
        )
