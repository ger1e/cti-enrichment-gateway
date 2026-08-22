import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MALTEGO = ROOT / 'maltego'

import sys
sys.path.insert(0, str(MALTEGO))
import bootstrap  # noqa: E402


class ProviderManifestParityTests(unittest.TestCase):
    def test_mtz_secret_denylist_derives_from_canonical_provider_manifest(self):
        manifest = json.loads((ROOT / 'config' / 'providers.json').read_text(encoding='utf-8'))
        expected = {
            policy['credentialEnv']
            for policy in manifest.values()
            if policy.get('credentialEnv')
        }
        expected.update({'CTI_GATEWAY_TOKEN', 'SENTRY_AUTH_TOKEN'})
        self.assertEqual(set(bootstrap.FORBIDDEN_MTZ_TOKENS), expected)
        self.assertIn('MODAT_API_KEY', bootstrap.FORBIDDEN_MTZ_TOKENS)


if __name__ == '__main__':
    unittest.main()
