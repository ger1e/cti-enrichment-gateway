import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRANSFORMS = ROOT / 'transforms'

class TransformParityTests(unittest.TestCase):
    def test_supported_gateway_types_have_discoverable_transforms(self):
        init = (TRANSFORMS / '__init__.py').read_text(encoding='utf-8')
        expected = {
            'ip': ['EnrichIPv4', 'EnrichIPv6'],
            'domain': ['EnrichDomain', 'EnrichDNSName'],
            'url': ['EnrichURL'],
            'hash': ['EnrichHash'],
            'cve': ['EnrichCVE'],
            'attack': ['EnrichATTACK'],
            'asn': ['EnrichASN'],
            'cidr': ['EnrichCIDR'],
        }
        for indicator_type, classes in expected.items():
            for class_name in classes:
                self.assertIn(class_name, init, f'{indicator_type} missing {class_name}')
                path = TRANSFORMS / f'{class_name}.py'
                self.assertTrue(path.exists(), f'{path.name} missing')
                text = path.read_text(encoding='utf-8')
                self.assertIn('execute_gateway_transform', text)
                if class_name in {'EnrichASN', 'EnrichCIDR'}:
                    self.assertIn("input_entity='maltego.Phrase'", text)
                    self.assertIn(f"execute_gateway_transform(request, response, '{indicator_type}')", text)

    def test_maltego_artifacts_contain_no_vendor_secret_names(self):
        forbidden = [
            'VIRUSTOTAL_API_KEY', 'SHODAN_API_KEY', 'ABUSEIPDB_API_KEY', 'GREYNOISE_API_KEY',
            'HYBRID_ANALYSIS_API_KEY', 'ABUSECH_API_KEY', 'URLSCAN_API_KEY', 'CENSYS_API_ID',
            'CENSYS_API_SECRET', 'OTX_API_KEY', 'PULSEDIVE_API_KEY', 'MALPEDIA_API_KEY',
        ]
        files = [ROOT / 'mapper.py', ROOT / 'project.py', ROOT / 'extensions.py', *TRANSFORMS.glob('*.py')]
        combined = '\n'.join(path.read_text(encoding='utf-8') for path in files)
        for name in forbidden:
            self.assertNotIn(name, combined)

    def test_gateway_token_remains_the_only_transform_credential_boundary(self):
        client = (ROOT / 'gateway_client.py').read_text(encoding='utf-8')
        store = (ROOT / 'credential_store.py').read_text(encoding='utf-8')
        combined = f'{client}\n{store}'
        self.assertIn('CTI_GATEWAY_TOKEN', combined)
        self.assertIn('DPAPI', combined.upper())
        self.assertIn('SUPPORTED_INDICATOR_TYPES', client)
        for indicator_type in ['ip', 'domain', 'url', 'hash', 'cve', 'attack', 'asn', 'cidr']:
            self.assertIn(repr(indicator_type), client)

if __name__ == '__main__':
    unittest.main()
