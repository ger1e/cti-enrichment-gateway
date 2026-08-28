from __future__ import annotations

import json
import os
import socket
import urllib.error
import urllib.request
from dataclasses import dataclass
from urllib.parse import urlparse

from credential_store import CredentialStoreError, load_token

DEFAULT_GATEWAY_URL = 'https://para11ax.vercel.app'
DEFAULT_TIMEOUT_SECONDS = 15.0
DEFAULT_MAX_RESPONSE_BYTES = 2_000_000
SUPPORTED_INDICATOR_TYPES = frozenset({'ip', 'domain', 'url', 'hash', 'cve', 'attack', 'asn', 'cidr'})


class GatewayError(RuntimeError):
    pass


class GatewayConfigurationError(GatewayError):
    pass


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, 'redirect refused', headers, fp)


def _validate_base_url(base_url: str) -> str:
    value = (base_url or '').strip().rstrip('/')
    parsed = urlparse(value)
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise GatewayConfigurationError('invalid PARA11AX URL')
    is_loopback = parsed.hostname in {'127.0.0.1', 'localhost', '::1'}
    if parsed.scheme != 'https' and not (parsed.scheme == 'http' and is_loopback):
        raise GatewayConfigurationError('PARA11AX URL must use HTTPS (HTTP is allowed only for localhost)')
    if parsed.path not in {'', '/'}:
        raise GatewayConfigurationError('PARA11AX URL must point to the gateway root')
    return value


@dataclass(frozen=True)
class GatewayClient:
    base_url: str
    token: str
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS
    max_response_bytes: int = DEFAULT_MAX_RESPONSE_BYTES
    opener: object | None = None

    @classmethod
    def from_environment(cls) -> 'GatewayClient':
        base_url = _validate_base_url(os.environ.get('PARA11AX_URL', DEFAULT_GATEWAY_URL))
        try:
            token = load_token()
        except CredentialStoreError as exc:
            raise GatewayConfigurationError(str(exc)) from exc
        if not token.strip():
            raise GatewayConfigurationError('PARA11AX token is empty')
        return cls(base_url=base_url, token=token.strip())

    def enrich(self, indicator: str, indicator_type: str) -> dict:
        if not isinstance(indicator, str) or not indicator.strip():
            raise GatewayError('indicator is empty')
        if indicator_type not in SUPPORTED_INDICATOR_TYPES:
            raise GatewayError('unsupported indicator type')

        endpoint = f'{_validate_base_url(self.base_url)}/api/para11ax/enrich'
        payload = json.dumps({'indicator': indicator.strip(), 'type': indicator_type}, separators=(',', ':')).encode('utf-8')
        request = urllib.request.Request(
            endpoint,
            data=payload,
            headers={
                'Authorization': f'Bearer {self.token}',
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'para11ax-maltego/2.0',
            },
            method='POST',
        )
        open_call = self.opener or urllib.request.build_opener(_NoRedirect()).open
        try:
            with open_call(request, timeout=self.timeout_seconds) as response:
                status = getattr(response, 'status', None) or response.getcode()
                raw = response.read(self.max_response_bytes + 1)
        except urllib.error.HTTPError as exc:
            raise GatewayError(f'gateway returned HTTP {exc.code}') from None
        except (urllib.error.URLError, socket.timeout, TimeoutError):
            raise GatewayError('gateway request failed or timed out') from None

        if status != 200:
            raise GatewayError(f'gateway returned HTTP {status}')
        if len(raw) > self.max_response_bytes:
            raise GatewayError('gateway response exceeded size limit')
        try:
            result = json.loads(raw.decode('utf-8'))
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise GatewayError('gateway returned invalid JSON') from None
        if not isinstance(result, dict):
            raise GatewayError('gateway returned an invalid response object')
        return result
