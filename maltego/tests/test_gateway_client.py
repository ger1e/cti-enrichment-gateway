import json
import os
import unittest
from unittest.mock import patch

from gateway_client import GatewayClient, GatewayConfigurationError, GatewayError, SUPPORTED_INDICATOR_TYPES, _validate_base_url
from credential_store import load_token

class FakeResponse:
    def __init__(self, payload, status=200):
        self.payload = payload
        self.status = status
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def getcode(self): return self.status
    def read(self, _limit): return self.payload

class GatewayClientTests(unittest.TestCase):
    def test_rejects_non_https_remote_gateway(self):
        with self.assertRaises(GatewayConfigurationError):
            _validate_base_url('http://example.com')

    def test_allows_local_http_for_development(self):
        self.assertEqual(_validate_base_url('http://127.0.0.1:3000/'), 'http://127.0.0.1:3000')

    def test_sends_only_gateway_bearer_token_and_expected_payload(self):
        seen = {}
        def opener(request, timeout):
            seen['url'] = request.full_url
            seen['auth'] = request.get_header('Authorization')
            seen['body'] = json.loads(request.data)
            seen['timeout'] = timeout
            return FakeResponse(b'{"status":"ok","evidence":[]}')
        client = GatewayClient('https://gateway.example', 'secret-token', opener=opener)
        result = client.enrich('8.8.8.8', 'ip')
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(seen['url'], 'https://gateway.example/api/para11ax/enrich')
        self.assertEqual(seen['auth'], 'Bearer secret-token')
        self.assertEqual(seen['body'], {'indicator': '8.8.8.8', 'type': 'ip'})
        self.assertEqual(seen['timeout'], 15.0)

    def test_v8_type_set_matches_transform_surface(self):
        self.assertEqual(SUPPORTED_INDICATOR_TYPES, frozenset({'ip', 'domain', 'url', 'hash', 'certificate', 'cve', 'attack', 'asn', 'cidr'}))
        seen = []
        def opener(request, timeout):
            seen.append(json.loads(request.data)['type'])
            return FakeResponse(b'{"status":"ok","evidence":[]}')
        client = GatewayClient('https://gateway.example', 'secret-token', opener=opener)
        fixtures = {
            'ip': '8.8.8.8', 'domain': 'example.com', 'url': 'https://example.com/',
            'hash': 'a' * 64, 'certificate': 'b' * 64, 'cve': 'CVE-2026-12345', 'attack': 'T1059.001',
            'asn': 'AS3333', 'cidr': '192.0.2.0/24',
        }
        for indicator_type, indicator in fixtures.items():
            self.assertEqual(client.enrich(indicator, indicator_type)['status'], 'ok')
        self.assertEqual(set(seen), set(fixtures))
        with self.assertRaises(GatewayError):
            client.enrich('x', 'unsupported')

    def test_certificate_transport_is_explicitly_prefixed_without_changing_file_hash(self):
        seen = []
        def opener(request, timeout):
            seen.append(json.loads(request.data))
            return FakeResponse(b'{"status":"ok","evidence":[]}')
        client = GatewayClient('https://gateway.example', 'secret-token', opener=opener)
        fingerprint = 'c' * 64
        self.assertEqual(client.enrich(fingerprint, 'hash')['status'], 'ok')
        self.assertEqual(client.enrich(fingerprint, 'certificate')['status'], 'ok')
        self.assertEqual(seen, [
            {'indicator': fingerprint, 'type': 'hash'},
            {'indicator': f'cert-sha256:{fingerprint}', 'type': 'certificate'},
        ])

    def test_environment_token_takes_precedence_without_touching_dpapi(self):
        with patch.dict(os.environ, {'PARA11AX_TOKEN': 'env-secret'}, clear=False):
            self.assertEqual(load_token(), 'env-secret')

if __name__ == '__main__':
    unittest.main()
