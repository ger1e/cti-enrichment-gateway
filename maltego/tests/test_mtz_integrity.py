import json
import stat
import unittest
import zipfile
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import bootstrap
from bootstrap import BootstrapError


CLASSES = [
    'EnrichIPv4', 'EnrichIPv6', 'EnrichDomain', 'EnrichDNSName', 'EnrichURL',
    'EnrichHash', 'EnrichCVE', 'EnrichATTACK', 'EnrichASN', 'EnrichCIDR',
]


def write_manifest(path: Path) -> None:
    path.write_text(json.dumps({
        'schemaVersion': '1.0',
        'transforms': [{'class': name, 'indicatorType': 'x', 'inputEntity': 'maltego.Phrase'} for name in CLASSES],
    }), encoding='utf-8')


def write_good_mtz(path: Path, extra: str = '') -> None:
    content = '\n'.join(CLASSES) + '\nhttps://para11ax.vercel.app\n' + extra
    with zipfile.ZipFile(path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('TransformRepositories/Local/transforms.txt', content)
        archive.writestr('Servers/Local/server.txt', 'local-transform-config')


class MtzIntegrityTests(unittest.TestCase):
    def test_good_mtz_returns_sha256(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            mtz = root / 'good.mtz'
            manifest = root / 'manifest.json'
            write_manifest(manifest)
            write_good_mtz(mtz)
            digest = bootstrap.verify_mtz(mtz, manifest_path=manifest)
            self.assertEqual(len(digest), 64)
            self.assertTrue(all(char in '0123456789abcdef' for char in digest))

    def test_missing_expected_transform_fails(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            mtz = root / 'bad.mtz'
            manifest = root / 'manifest.json'
            write_manifest(manifest)
            with zipfile.ZipFile(mtz, 'w') as archive:
                archive.writestr('config.txt', '\n'.join(CLASSES[:-1]))
            with self.assertRaisesRegex(BootstrapError, 'missing expected transforms'):
                bootstrap.verify_mtz(mtz, manifest_path=manifest)

    def test_secret_identifiers_and_loopback_urls_fail(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / 'manifest.json'
            write_manifest(manifest)
            for extra in ['VIRUSTOTAL_API_KEY', 'PARA11AX_TOKEN', 'http://localhost:3000']:
                mtz = root / f"bad-{len(extra)}.mtz"
                write_good_mtz(mtz, extra)
                with self.subTest(extra=extra):
                    with self.assertRaises(BootstrapError):
                        bootstrap.verify_mtz(mtz, manifest_path=manifest)

    def test_archive_path_traversal_fails_without_extraction(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            mtz = root / 'bad.mtz'
            manifest = root / 'manifest.json'
            write_manifest(manifest)
            with zipfile.ZipFile(mtz, 'w') as archive:
                archive.writestr('../escape.txt', '\n'.join(CLASSES))
            with self.assertRaisesRegex(BootstrapError, 'unsafe archive path'):
                bootstrap.verify_mtz(mtz, manifest_path=manifest)
            self.assertFalse((root.parent / 'escape.txt').exists())

    def test_duplicate_archive_entry_fails(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            mtz = root / 'bad.mtz'
            manifest = root / 'manifest.json'
            write_manifest(manifest)
            with zipfile.ZipFile(mtz, 'w') as archive:
                archive.writestr('same.txt', '\n'.join(CLASSES))
                archive.writestr('same.txt', '\n'.join(CLASSES))
            with self.assertRaisesRegex(BootstrapError, 'duplicate archive entries'):
                bootstrap.verify_mtz(mtz, manifest_path=manifest)

    def test_symbolic_link_entry_fails(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            mtz = root / 'bad.mtz'
            manifest = root / 'manifest.json'
            write_manifest(manifest)
            info = zipfile.ZipInfo('link')
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            with zipfile.ZipFile(mtz, 'w') as archive:
                archive.writestr(info, 'target')
                archive.writestr('classes.txt', '\n'.join(CLASSES))
            with self.assertRaisesRegex(BootstrapError, 'symbolic link'):
                bootstrap.verify_mtz(mtz, manifest_path=manifest)

    def test_oversized_entry_fails_before_acceptance(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            mtz = root / 'bad.mtz'
            manifest = root / 'manifest.json'
            write_manifest(manifest)
            with zipfile.ZipFile(mtz, 'w') as archive:
                archive.writestr('large.txt', '\n'.join(CLASSES) + 'x' * 256)
            with patch.object(bootstrap, 'MAX_MTZ_ENTRY_BYTES', 100):
                with self.assertRaisesRegex(BootstrapError, 'oversized entry'):
                    bootstrap.verify_mtz(mtz, manifest_path=manifest)

    def test_duplicate_manifest_classes_fail(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            mtz = root / 'good.mtz'
            manifest = root / 'manifest.json'
            write_good_mtz(mtz)
            manifest.write_text(json.dumps({'transforms': [{'class': 'X'}, {'class': 'X'}]}), encoding='utf-8')
            with self.assertRaisesRegex(BootstrapError, 'duplicate transform classes'):
                bootstrap.verify_mtz(mtz, manifest_path=manifest)


if __name__ == '__main__':
    unittest.main()
