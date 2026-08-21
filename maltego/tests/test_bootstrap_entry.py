import os
import unittest
from unittest.mock import patch

import bootstrap_entry
from credential_store import CredentialStoreError


class BootstrapEntryTests(unittest.TestCase):
    def test_macos_first_setup_uses_keychain_native_prompt_once(self):
        with patch.object(bootstrap_entry.sys, 'platform', 'darwin'):
            with patch.dict(os.environ, {}, clear=True):
                with patch.object(bootstrap_entry, 'load_token', side_effect=CredentialStoreError('missing')):
                    with patch.object(bootstrap_entry, 'configure_token_interactively') as configure:
                        bootstrap_entry.prepare_native_credential([])
        configure.assert_called_once_with()

    def test_macos_existing_keychain_token_does_not_prompt(self):
        with patch.object(bootstrap_entry.sys, 'platform', 'darwin'):
            with patch.dict(os.environ, {}, clear=True):
                with patch.object(bootstrap_entry, 'load_token', return_value='configured'):
                    with patch.object(bootstrap_entry, 'configure_token_interactively') as configure:
                        bootstrap_entry.prepare_native_credential([])
        configure.assert_not_called()

    def test_environment_override_is_never_persisted_to_keychain(self):
        with patch.object(bootstrap_entry.sys, 'platform', 'darwin'):
            with patch.dict(os.environ, {'CTI_GATEWAY_TOKEN': 'ephemeral'}, clear=True):
                with patch.object(bootstrap_entry, 'load_token', side_effect=AssertionError('native store touched')):
                    with patch.object(bootstrap_entry, 'configure_token_interactively') as configure:
                        bootstrap_entry.prepare_native_credential([])
        configure.assert_not_called()

    def test_noninteractive_mode_never_prompts(self):
        with patch.object(bootstrap_entry.sys, 'platform', 'darwin'):
            with patch.dict(os.environ, {}, clear=True):
                with patch.object(bootstrap_entry, 'load_token', side_effect=CredentialStoreError('missing')):
                    with patch.object(bootstrap_entry, 'configure_token_interactively') as configure:
                        bootstrap_entry.prepare_native_credential(['--non-interactive'])
        configure.assert_not_called()

    def test_check_and_uninstall_are_read_only_with_respect_to_prompting(self):
        with patch.object(bootstrap_entry.sys, 'platform', 'darwin'):
            with patch.dict(os.environ, {}, clear=True):
                with patch.object(bootstrap_entry, 'configure_token_interactively') as configure:
                    bootstrap_entry.prepare_native_credential(['--check'])
                    bootstrap_entry.prepare_native_credential(['--uninstall'])
        configure.assert_not_called()

    def test_non_macos_platforms_delegate_credential_handling_to_bootstrap(self):
        with patch.object(bootstrap_entry.sys, 'platform', 'linux'):
            with patch.object(bootstrap_entry, 'load_token', side_effect=AssertionError('store touched')):
                with patch.object(bootstrap_entry, 'configure_token_interactively') as configure:
                    bootstrap_entry.prepare_native_credential([])
        configure.assert_not_called()


if __name__ == '__main__':
    unittest.main()
