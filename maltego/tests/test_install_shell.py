import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT / 'install.sh').read_text(encoding='utf-8')
ENTRY = (ROOT / 'bootstrap_entry.py').read_text(encoding='utf-8')


class InstallShellTests(unittest.TestCase):
    def test_shell_installer_never_writes_shell_profiles(self):
        for forbidden in ['.zshrc', '.zprofile', '.bashrc', '.bash_profile', '>> ~/.']:
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, SCRIPT)

    def test_shell_installer_checks_python_before_delegating(self):
        self.assertIn("sys.version_info >= (3, 10)", SCRIPT)
        self.assertIn('python3.12', SCRIPT)
        self.assertIn('bootstrap_entry.py', SCRIPT)
        self.assertIn('exec "$PYTHON" "$BOOTSTRAP" "$@"', SCRIPT)

    def test_secure_entry_delegates_to_shared_bootstrap(self):
        self.assertIn('import bootstrap', ENTRY)
        self.assertIn('configure_token_interactively', ENTRY)
        self.assertIn("sys.platform != 'darwin'", ENTRY)
        self.assertIn("os.environ.get('CTI_GATEWAY_TOKEN'", ENTRY)
        self.assertIn('return bootstrap.main(args)', ENTRY)

    def test_shell_installer_considers_standard_homebrew_locations(self):
        self.assertIn('/opt/homebrew/bin/brew', SCRIPT)
        self.assertIn('/usr/local/bin/brew', SCRIPT)
        self.assertIn('/home/linuxbrew/.linuxbrew/bin/brew', SCRIPT)

    def test_shell_installer_does_not_execute_remote_bootstrap_scripts(self):
        self.assertNotIn('curl ', SCRIPT)
        self.assertNotIn('wget ', SCRIPT)
        self.assertNotIn('raw.githubusercontent.com/Homebrew/install', SCRIPT)

    def test_shell_installer_contains_no_gateway_token_argument_or_plaintext_store(self):
        self.assertNotIn('CTI_GATEWAY_TOKEN=', SCRIPT)
        self.assertNotIn('.env', SCRIPT)
        self.assertNotIn('echo "$CTI_GATEWAY_TOKEN"', SCRIPT)

    def test_linux_guidance_covers_major_package_managers(self):
        for manager in ['apt-get', 'dnf', 'yum', 'zypper', 'pacman', 'apk']:
            with self.subTest(manager=manager):
                self.assertIn(manager, SCRIPT)

    def test_script_is_posix_oriented_for_bash_and_zsh_compatibility(self):
        self.assertTrue(SCRIPT.startswith('#!/bin/sh\nset -eu\n'))
        for bash_only in ['[[', 'declare -a', 'mapfile', 'BASH_SOURCE', 'function ']:
            with self.subTest(bash_only=bash_only):
                self.assertNotIn(bash_only, SCRIPT)


if __name__ == '__main__':
    unittest.main()
