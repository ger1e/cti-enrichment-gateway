import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

import bootstrap
from bootstrap import BootstrapError, PythonCandidate


class BootstrapTests(unittest.TestCase):
    def test_python_version_floor_is_310(self):
        self.assertFalse(bootstrap.supported_version((3, 9, 18)))
        self.assertTrue(bootstrap.supported_version((3, 10, 0)))
        self.assertTrue(bootstrap.supported_version((3, 13, 1)))

    def test_python_312_is_preferred_over_newer_supported_interpreter(self):
        candidates = [
            PythonCandidate((3, 13, 2), '/python313'),
            PythonCandidate((3, 12, 9), '/python312'),
            PythonCandidate((3, 11, 8), '/python311'),
        ]
        self.assertEqual(bootstrap.choose_python(candidates).executable, '/python312')

    def test_highest_supported_version_is_used_when_312_is_absent(self):
        candidates = [
            PythonCandidate((3, 11, 9), '/python311'),
            PythonCandidate((3, 13, 2), '/python313'),
            PythonCandidate((3, 9, 20), '/python39'),
        ]
        self.assertEqual(bootstrap.choose_python(candidates).executable, '/python313')

    def test_venv_action_rebuilds_python_39_and_corrupt_environments(self):
        with TemporaryDirectory() as tmp:
            venv = Path(tmp) / '.venv'
            python = venv / 'bin' / 'python'
            python.parent.mkdir(parents=True)
            python.write_text('', encoding='utf-8')
            with patch.object(bootstrap, 'probe_python', return_value=(3, 9, 19)):
                self.assertEqual(bootstrap.venv_action(venv), ('rebuild', (3, 9, 19)))
            with patch.object(bootstrap, 'probe_python', return_value=None):
                self.assertEqual(bootstrap.venv_action(venv), ('rebuild', None))
            with patch.object(bootstrap, 'probe_python', return_value=(3, 12, 7)):
                self.assertEqual(bootstrap.venv_action(venv), ('reuse', (3, 12, 7)))

    def test_missing_venv_is_created(self):
        with TemporaryDirectory() as tmp:
            self.assertEqual(bootstrap.venv_action(Path(tmp) / '.venv'), ('create', None))

    def test_gateway_url_requires_https_except_loopback_and_root_path(self):
        self.assertEqual(bootstrap.validate_gateway_url('https://gateway.example/'), 'https://gateway.example')
        self.assertEqual(bootstrap.validate_gateway_url('http://127.0.0.1:3000/'), 'http://127.0.0.1:3000')
        for value in [
            'http://gateway.example',
            'https://user:pass@gateway.example',
            'https://gateway.example/api',
            'https://gateway.example?x=1',
        ]:
            with self.subTest(value=value):
                with self.assertRaises(BootstrapError):
                    bootstrap.validate_gateway_url(value)

    def test_uninstall_preserves_credential_unless_explicitly_requested(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.venv').mkdir()
            (root / '.venv' / 'marker').write_text('x', encoding='utf-8')
            (root / 'cti-enrichment-gateway-local.mtz').write_bytes(b'mtz')
            delete = Mock()
            bootstrap.remove_local_artifacts(root=root, credential_delete=delete)
            self.assertFalse((root / '.venv').exists())
            self.assertFalse((root / 'cti-enrichment-gateway-local.mtz').exists())
            delete.assert_not_called()

            (root / '.venv').mkdir()
            bootstrap.remove_local_artifacts(root=root, delete_credential=True, credential_delete=delete)
            delete.assert_called_once()

    def test_safe_remove_refuses_paths_outside_root(self):
        with TemporaryDirectory() as root_tmp, TemporaryDirectory() as other_tmp:
            with self.assertRaisesRegex(BootstrapError, 'outside Maltego root'):
                bootstrap._safe_remove_tree(Path(other_tmp), root=Path(root_tmp))

    @unittest.skipIf(os.name == 'nt', 'symlink semantics differ on Windows CI')
    def test_safe_remove_unlinks_symlink_without_following_target(self):
        with TemporaryDirectory() as tmp, TemporaryDirectory() as outside:
            root = Path(tmp)
            target = Path(outside) / 'keep'
            target.mkdir()
            marker = target / 'marker'
            marker.write_text('keep', encoding='utf-8')
            link = root / '.venv'
            link.symlink_to(target, target_is_directory=True)
            bootstrap._safe_remove_tree(link, root=root)
            self.assertFalse(link.exists())
            self.assertTrue(marker.exists())

    def test_noninteractive_missing_credential_fails_without_prompt(self):
        with patch.object(bootstrap, 'load_token', side_effect=bootstrap.CredentialStoreError('not configured')):
            with patch.object(bootstrap.getpass, 'getpass', side_effect=AssertionError('prompted')):
                with self.assertRaisesRegex(BootstrapError, 'not configured'):
                    bootstrap._credential_ready(non_interactive=True)

    def test_run_checked_does_not_reflect_subprocess_output_on_failure(self):
        completed = bootstrap.subprocess.CompletedProcess([], 7, 'secret-ish stdout', 'secret-ish stderr')
        with patch.object(bootstrap.subprocess, 'run', return_value=completed):
            with self.assertRaises(BootstrapError) as raised:
                bootstrap.run_checked(['/bin/fail'])
        text = str(raised.exception)
        self.assertNotIn('secret-ish stdout', text)
        self.assertNotIn('secret-ish stderr', text)
        self.assertIn('exit code 7', text)

    def test_delete_credential_flag_is_rejected_without_uninstall(self):
        self.assertEqual(bootstrap.main(['--delete-credential']), 1)


if __name__ == '__main__':
    unittest.main()
