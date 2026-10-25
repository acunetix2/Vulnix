"""The egress guard is the only thing between a workspace admin's webhook URL
and the internal network, so its rejections are tested individually."""

import socket

import pytest

from app.core import egress
from app.core.config import settings
from app.core.errors import AppError

PUBLIC = "93.184.216.34"


def _dns(monkeypatch, *addresses: str) -> None:
    def fake(host, port=None, **kwargs):  # matches the real call signature we use
        return [(socket.AF_INET, socket.SOCK_STREAM, 0, "", (addr, 443)) for addr in addresses]

    monkeypatch.setattr(egress.socket, "getaddrinfo", fake)


def _code(monkeypatch, url: str, *addresses: str) -> str | None:
    _dns(monkeypatch, *addresses)
    try:
        egress.assert_egress_allowed(url)
    except AppError as exc:
        return exc.code
    return None


def test_https_public_host_passes(monkeypatch) -> None:
    _dns(monkeypatch, PUBLIC)
    assert egress.assert_egress_allowed("https://Hooks.Example.COM/a/b?x=1") == "https://hooks.example.com/a/b?x=1"


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com/hook",
        "ftp://example.com/hook",
        "https://user:pass@example.com/hook",
        "https://example.com:8444/hook",
        "https:///hook",
        "   ",
        "https://example.com/" + "x" * 1100,
    ],
)
def test_rejected_urls(monkeypatch, url: str) -> None:
    _dns(monkeypatch, PUBLIC)
    assert _code(monkeypatch, url, PUBLIC) == "INVALID_WEBHOOK_URL"


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.0.0.1",
        "172.16.5.5",
        "192.168.1.1",
        "169.254.169.254",
        "0.0.0.0",
        "224.0.0.1",
        "100.64.0.1",
        "::1",
        "fe80::1",
        "fc00::1",
        "::ffff:127.0.0.1",
    ],
)
def test_non_public_targets_are_blocked(monkeypatch, address: str) -> None:
    assert _code(monkeypatch, "https://internal.example.com/hook", address) == "TARGET_BLOCKED"


def test_one_private_answer_blocks_a_multi_answer_dns(monkeypatch) -> None:
    # DNS rebalancing: the public record is not a licence to also reach the internal one.
    assert _code(monkeypatch, "https://example.com/hook", PUBLIC, "169.254.169.254") == "TARGET_BLOCKED"


def test_private_targets_opt_in(monkeypatch) -> None:
    monkeypatch.setattr(settings, "integration_allow_private_targets", True)
    _dns(monkeypatch, "10.0.0.1")
    assert egress.assert_egress_allowed("https://jira.internal.corp/rest/api/3/issue").startswith("https://")


def test_unresolvable_host(monkeypatch) -> None:
    def fake(host, port=None, **kwargs):
        raise socket.gaierror("no answer")

    monkeypatch.setattr(egress.socket, "getaddrinfo", fake)
    assert _code(monkeypatch, "https://gone.example.com/hook") == "TARGET_UNREACHABLE"


def test_no_empty_dns_answer(monkeypatch) -> None:
    monkeypatch.setattr(egress.socket, "getaddrinfo", lambda *a, **k: [])
    assert _code(monkeypatch, "https://gone.example.com/hook") == "TARGET_UNREACHABLE"


def test_fragment_is_dropped(monkeypatch) -> None:
    _dns(monkeypatch, PUBLIC)
    assert egress.assert_egress_allowed("https://example.com/hook#frag") == "https://example.com/hook"
