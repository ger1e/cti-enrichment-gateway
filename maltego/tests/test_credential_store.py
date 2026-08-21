import os
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import credential_store
from credential_store import CredentialStoreError


class CredentialStoreTests(unittest.TestCase):
    def test_environment_override_has_highest_precedence(self):
        with patch.dict(os.environ, {'CTI_GATEWAY_TOKEN': ' env-secret '}, clear=False):
            with patch.object(credential_store, '_native_backend_name', side_effect=AssertionError('native backend touched')):
                self.assertEqual(credential_store.load_token(), 'env-secret')
                self.assertEqual(credential_store.backend_name(), 'environment')

    def test_windows_dpapi_round_trip_uses_only_protected_file(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / 'gateway-token.dpapi'
            with patch.object(credential_store, '_native_backend_name', return_value='windows-dpapi'):
                with patch.object(credential_store, '_protect', return_value=b'ciphertext') as protect:
                    credential_store.save_token('super-secret', path)
                self.assertNotIn('super-secret', path.read_text(encoding='ascii'))
                protect.assert_called_once_with(b'super-secret')
                with patch.object(credential_store, '_unprotect', return_value=b'super-secret') as unprotect:
                    self.assertEqual(credential_store.load_token(path), 'super-secret')
                unprotect.assert_called_once_with(b'ciphertext')
                credential_store.delete_token(path)
                self.assertFalse(path.exists())

    def test_macos_keychain_save_keeps_secret_out_of_argv(self):
        completed = subprocess.CompletedProcess([], 0, '', '')
        with patch.object(credential_store, '_native_backend_name', return_value='macos-keychain'):
            with patch.object(credential_store, '_run_native', return_value=completed) as run:
                credential_store.save_token('mac-secret')
        args, kwargs = run.call_args
        self.assertEqual(args[0][-1], '-w')
        self.assertNotIn('mac-secret', args[0])
        self.assertEqual(kwargs['input_text'], 'mac-secret\n')

    def test_macos_keychain_load_and_delete(self):
        load = subprocess.CompletedProcess([], 0, 'mac-secret\n', '')
        deleted = subprocess.CompletedProcess([], 0, '', '')
        with patch.object(credential_store, '_native_backend_name', return_value='macos-keychain'):
            with patch.object(credential_store, '_run_native', side_effect=[load, deleted]) as run:
                self.assertEqual(credential_store.load_token(), 'mac-secret')
                credential_store.delete_token()
        self.assertIn('find-generic-password', run.call_args_list[0].args[0])
        self.assertIn('delete-generic-password', run.call_args_list[1].args[0])
        self.assertTrue(run.call_args_list[1].kwargs['not_found_ok'])

    def test_linux_secret_service_uses_stdin_not_argv(self):
        completed = subprocess.CompletedProcess([], 0, '', '')
        with patch.object(credential_store, '_native_backend_name', return_value='linux-secret-service'):
            with patch.object(credential_store, '_secret_tool', return_value='/usr/bin/secret-tool'):
                with patch.object(credential_store, '_run_native', return_value=completed) as run:
                    credential_store.save_token('linux-secret')
        args, kwargs = run.call_args
        self.assertNotIn('linux-secret', args[0])
        self.assertEqual(kwargs['input_text'], 'linux-secret')
        self.assertEqual(args[0][0], '/usr/bin/secret-tool')
        self.assertIn('store', args[0])

    def test_linux_secret_service_load_and_delete(self):
        load = subprocess.CompletedProcess([], 0, 'linux-secret\n', '')
        deleted = subprocess.CompletedProcess([], 0, '', '')
        with patch.object(credential_store, '_native_backend_name', return_value='linux-secret-service'):
            with patch.object(credential_store, '_secret_tool', return_value='/usr/bin/secret-tool'):
                with patch.object(credential_store, '_run_native', side_effect=[load, deleted]) as run:
                    self.assertEqual(credential_store.load_token(), 'linux-secret')
                    credential_store.delete_token()
        self.assertIn('lookup', run.call_args_list[0].args[0])
        self.assertIn('clear', run.call_args_list[1].args[0])

    def test_linux_without_secret_service_fails_closed(self):
        with patch.object(credential_store.os, 'name', 'posix'):
            with patch.object(credential_store.sys, 'platform', 'linux'):
                with patch.object(credential_store.shutil, 'which', return_value=None):
                    with self.assertRaisesRegex(CredentialStoreError, 'no secure Linux credential backend'):
                        credential_store._native_backend_name()

    def test_native_command_error_does_not_reflect_secret(self):
        failure = subprocess.CompletedProcess([], 1, 'upstream output', 'backend failure')
        with patch.object(credential_store.subprocess, 'run', return_value=failure):
            with self.assertRaises(CredentialStoreError) as raised:
                credential_store._run_native(['/bin/false'], input_text='do-not-leak')
        self.assertNotIn('do-not-leak', str(raised.exception))
        self.assertNotIn('upstream output', str(raised.exception))
        self.assertNotIn('backend failure', str(raised.exception))

    def test_cli_supports_backend_delete_check_and_save(self):
        with patch.object(credential_store, 'backend_name', return_value='macos-keychain'):
            self.assertEqual(credential_store._main(['credential_store.py', 'backend']), 0)
        with patch.object(credential_store, 'load_token', return_value='x') as load:
            self.assertEqual(credential_store._main(['credential_store.py', 'check']), 0)
            load.assert_called_once()
        with patch.object(credential_store, 'delete_token') as delete:
            self.assertEqual(credential_store._main(['credential_store.py', 'delete']), 0)
            delete.assert_called_once()


if __name__ == '__main__':
    unittest.main()
