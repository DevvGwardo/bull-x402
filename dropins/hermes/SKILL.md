# Hermes skill — Bull.inf x402

Agents that pay themselves in `$ANSEM` via Bull.inf’s x402 rail (no `inf_` key).

## Env

```bash
export BULL_API_BASE=https://api.bullinf.fun
export BULL_X402_SEED_HEX=...          # 32-byte seed hex
# or: export BULL_X402_KEYPAIR=/path/to/id.json
export BULL_MODEL=llama-3.1-8b-instant
export SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

## Install

```bash
pip install bull-x402
# or from this repo:
pip install -e packages/py
```

## One-shot chat

```bash
python dropins/hermes/chat_once.py "gm from hermes"
```

## Dogfood loop

```bash
python dropins/hermes/dogfood_loop.py 10
```

Use the keyed `inf_` path from Bull.inf DOGFOOD.md when you want volume without managing a hot wallet.
