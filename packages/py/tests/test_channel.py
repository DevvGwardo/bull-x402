from bull_x402 import WalletChannel


def test_channel_bumps():
    ch = WalletChannel()
    assert ch.next_cumulative(1000) == 1000
    ch.commit(1000)
    assert ch.next_cumulative(500) == 1500
    assert ch.fresh_nonce()
