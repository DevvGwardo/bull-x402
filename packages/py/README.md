# bull-x402 (Python)

```bash
pip install bull-x402
```

```python
from bull_x402 import keypair_from_seed, create_paid_client

kp = keypair_from_seed(bytes([0x11] * 32))  # use your own secret
client = create_paid_client(keypair=kp)
res = client.chat.completions.create(
    model="llama-3.1-8b-instant",
    messages=[{"role": "user", "content": "gm"}],
)
print(res["choices"][0]["message"]["content"])
```

See the repo root README and PROTOCOL.md.
