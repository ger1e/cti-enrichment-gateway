from __future__ import annotations

import sys
from pathlib import Path

import transforms
from extensions import registry
from maltego_trx.handler import handle_run
from maltego_trx.registry import register_transform_classes
from maltego_trx.server import application

ROOT = Path(__file__).resolve().parent
register_transform_classes(transforms)


def write_local_mtz() -> Path:
    mtz_path = ROOT / 'cti-enrichment-gateway-local.mtz'
    registry.write_local_mtz(
        mtz_path=str(mtz_path),
        working_dir=str(ROOT),
        command=sys.executable,
        params='project.py',
        debug=False,
    )
    return mtz_path


if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'mtz':
    print(write_local_mtz())
    raise SystemExit(0)

handle_run(__name__, sys.argv, application)
