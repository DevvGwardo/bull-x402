# Publishing

## npm (`@bullinf/x402`)

```bash
cd packages/ts
npm login
npm publish --access public
```

Requires npm org/user permission for scope `@bullinf`.

## PyPI (`bull-x402`)

```bash
cd packages/py
python -m pip install build twine
python -m build
twine upload dist/*
```

## GitHub

Create public repo `DevvGwardo/bull-x402`, push `main`, CI runs on PRs.
