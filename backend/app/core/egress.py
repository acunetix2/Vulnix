"""Outbound URL guard for every integration request.

A workspace admin can point a webhook at any URL, which makes the delivery
worker an egress proxy for whoever can edit it. This module is the single place
that decides whether a target is reachable, and it runs on every attempt —
including retries — because DNS can change between them.
"""

import ipaddress
import logging
import socket
from urllib.parse import urlsplit, urlunsplit

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger("vulnix.egress")

_ALLOWED_SCHEMES = {"https"}
# Kept separate from the port we connect to so a redirect cannot swap them.
_MAX_URL_LENGTH = 1024
_ALLOWED_PORTS = {443, 8443}
# Carrier-grade NAT (RFC 6598) is not covered by ipaddress.is_private, yet
# several providers expose their metadata service inside it.
_CGNAT = ipaddress.ip_network("100.64.0.0/10")


def _is_private(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    # is_private alone leaves out the cloud metadata endpoint's neighbours, and
    # is_global excludes the documentation ranges we also want to block.
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
        or (addr.version == 4 and addr in _CGNAT)
        or (getattr(addr, "ipv4_mapped", None) is not None and _is_private(addr.ipv4_mapped))
    )


def normalize_url(raw: str) -> str:
    """Validate scheme and shape only. Use assert_egress_allowed before sending."""
    value = (raw or "").strip()
    if not value or len(value) > _MAX_URL_LENGTH:
        raise AppError("INVALID_WEBHOOK_URL", "Webhook URL is missing or too long.", 422)
    try:
        parts = urlsplit(value)
        port = parts.port  # raises ValueError for a malformed port
    except ValueError:
        raise AppError("INVALID_WEBHOOK_URL", "Webhook URL could not be parsed.", 422) from None

    if parts.scheme.lower() not in _ALLOWED_SCHEMES:
        raise AppError("INVALID_WEBHOOK_URL", "Only HTTPS URLs are allowed.", 422)
    if not parts.hostname:
        raise AppError("INVALID_WEBHOOK_URL", "Webhook URL must include a host.", 422)
    if "@" in parts.netloc:
        # Userinfo in a URL is a classic SSRF/credential-smuggling trick.
        raise AppError("INVALID_WEBHOOK_URL", "Webhook URL must not contain credentials.", 422)
    if port is not None and port not in _ALLOWED_PORTS:
        raise AppError("INVALID_WEBHOOK_URL", "Only ports 443 and 8443 are allowed.", 422)

    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), parts.path, parts.query, ""))


def assert_egress_allowed(url: str) -> str:
    """Resolve the host and reject any address that is not a public unicast target.

    Returns the normalized URL. Resolution happens here rather than relying on
    the HTTP client so that a hostname rebound to 169.254.169.254 is caught.
    """
    normalized = normalize_url(url)
    hostname = urlsplit(normalized).hostname

    try:
        infos = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise AppError("TARGET_UNREACHABLE", "Webhook host could not be resolved.", 400) from None

    if not infos:
        raise AppError("TARGET_UNREACHABLE", "Webhook host could not be resolved.", 400)

    for info in infos:
        ip = info[4][0]
        try:
            addr = ipaddress.ip_address(ip)
        except ValueError:
            raise AppError("TARGET_BLOCKED", "Webhook host resolved to an invalid address.", 400) from None
        if not settings.integration_allow_private_targets and _is_private(addr):
            # Log the host and not the resolved address: the address itself can
            # describe internal topology.
            logger.warning("egress_blocked host=%s", hostname)
            raise AppError("TARGET_BLOCKED", "This target address is not allowed.", 400)

    return normalized
