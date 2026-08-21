import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT / 'install.ps1').read_text(encoding='utf-8')


class InstallPowerShellTests(unittest.TestCase):
    def test_windows_installer_validates_python_310_floor_before_bootstrap(self):
        self.assertIn('version.Minor -ge 10', SCRIPT)
        self.assertIn("'-3.12'", SCRIPT)
        self.assertIn("'-3.13'", SCRIPT)
        self.assertIn('Test-PythonCandidate', SCRIPT)

    def test_windows_installer_uses_winget_only_when_compatible_python_is_missing(self):
        self.assertIn('Find-CompatiblePython', SCRIPT)
        self.assertIn('Install-CompatiblePython', SCRIPT)
        self.assertIn('Python.Python.3.12', SCRIPT)
        self.assertIn('Python.Python.3.13', SCRIPT)
        self.assertIn('winget.exe install', SCRIPT)

    def test_windows_installer_delegates_lifecycle_to_shared_bootstrap(self):
        self.assertIn("$Bootstrap = Join-Path $Root 'bootstrap.py'", SCRIPT)
        for flag in ['--check', '--repair', '--update', '--uninstall', '--delete-credential', '--non-interactive', '--gateway-url']:
            with self.subTest(flag=flag):
                self.assertIn(flag, SCRIPT)

    def test_windows_installer_does_not_handle_plaintext_token_or_vendor_secrets(self):
        for forbidden in ['Read-Host \'CTI_GATEWAY_TOKEN', 'SecureStringToBSTR', 'VIRUSTOTAL_API_KEY', 'GREYNOISE_API_KEY', '.env']:
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, SCRIPT)
        self.assertIn('vendor API credentials remain server-side in Vercel', SCRIPT)

    def test_delete_credential_requires_uninstall(self):
        self.assertIn('$DeleteCredential -and -not $Uninstall', SCRIPT)


if __name__ == '__main__':
    unittest.main()
