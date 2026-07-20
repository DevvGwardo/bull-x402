"""Opt-in live check: BULL_X402_LIVE=1 pytest -q tests/test_live.py"""
from __future__ import annotations

import os

import pytest

from bull_x402 import load_info


@pytest.mark.skipif(os.environ.get("BULL_X402_LIVE") != "1", reason="set BULL_X402_LIVE=1")
def test_live_x402_info():
    info = load_info(os.environ.get("BULL_API_BASE", "https://api.bullinf.fun"))
    assert info.get("preferred") == "ansem-batch"
    assert info.get("payTo")
    assert info.get("asset")
    assert info.get("domain") == "bull.x402.v1"
