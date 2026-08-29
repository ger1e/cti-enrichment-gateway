import json
import re
from typing import Any

from user_scanner.core.cross_scan import CrossScanConfig, run_cross_scan
from user_scanner.core.email_orchestrator import (
    run_email_category_batch,
    run_email_full_batch,
    run_email_module_batch,
)
from user_scanner.core.formatter import into_json
from user_scanner.core.helpers import ScanConfig, find_module, load_categories
from user_scanner.core.orchestrator import run_user_category, run_user_full, run_user_module
from user_scanner.core.result import Status

_SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


def _validate(payload: dict[str, Any]) -> dict[str, Any]:
    allowed = {"scan_type", "target", "category", "module", "cross_scan", "no_nsfw"}
    if set(payload) - allowed:
        raise ValueError("unsupported_request_field")
    scan_type = payload.get("scan_type")
    if scan_type not in {"email", "username"}:
        raise ValueError("invalid_scan_type")
    target = payload.get("target")
    if not isinstance(target, str) or not target.strip() or len(target.strip()) > 320:
        raise ValueError("invalid_target")
    category = payload.get("category")
    module = payload.get("module")
    if category is not None and (not isinstance(category, str) or not _SAFE_NAME.fullmatch(category)):
        raise ValueError("invalid_category")
    if module is not None and (not isinstance(module, str) or not _SAFE_NAME.fullmatch(module)):
        raise ValueError("invalid_module")
    if category and module:
        raise ValueError("category_module_conflict")
    if "cross_scan" in payload and not isinstance(payload["cross_scan"], bool):
        raise ValueError("invalid_cross_scan")
    if "no_nsfw" in payload and not isinstance(payload["no_nsfw"], bool):
        raise ValueError("invalid_no_nsfw")
    return {
        "scan_type": scan_type,
        "target": target.strip(),
        "category": category,
        "module": module.replace(".", "_") if module else None,
        "cross_scan": payload.get("cross_scan") is True,
        "no_nsfw": payload.get("no_nsfw", True) is not False,
    }


def _run_base(scan: dict[str, Any], config: ScanConfig):
    target = scan["target"]
    is_email = scan["scan_type"] == "email"
    module = scan["module"]
    category = scan["category"]

    if module:
        modules = find_module(module, is_email=is_email, no_nsfw=config.no_nsfw)
        if not modules:
            return []
        return run_email_module_batch(modules, target, config) if is_email else run_user_module(modules, target, config)

    if category:
        categories = load_categories(is_email=is_email, no_nsfw=config.no_nsfw)
        category_path = categories.get(category)
        if not category_path:
            return []
        return run_email_category_batch(category_path, target, config) if is_email else run_user_category(category_path, target, config)

    return run_email_full_batch(target, config) if is_email else run_user_full(target, config)


def run_scan(payload: dict[str, Any]) -> dict[str, Any]:
    scan = _validate(payload)
    config = ScanConfig(allow_loud=False, no_nsfw=scan["no_nsfw"])
    results = list(_run_base(scan, config))

    if scan["cross_scan"]:
        cross_config = CrossScanConfig(
            links="all",
            emails="verified",
            sweep=3,
            depth=1,
            modules=(scan["module"],) if scan["module"] else (),
            categories=(scan["category"],) if scan["category"] else (),
        )
        results.extend(run_cross_scan(results, config, cross_config))

    found = [result for result in results if result.status == Status.TAKEN]
    errors = [result for result in results if result.status == Status.ERROR]
    skipped = [result for result in results if result.status == Status.SKIPPED]

    return {
        "summary": {
            "total_scanned": len(results),
            "found": len(found),
            "not_found": len(results) - len(found) - len(errors) - len(skipped),
            "errors": len(errors),
            "skipped": len(skipped),
        },
        "results": json.loads(into_json(found)),
        "errored_sites": [result.site_name for result in errors if result.site_name],
    }
