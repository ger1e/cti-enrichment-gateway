from __future__ import annotations

import os

from maltego_trx.maltego import UIM_FATAL, UIM_INFORM, UIM_PARTIAL

from gateway_client import GatewayClient, GatewayConfigurationError, GatewayError
from mapper import map_enrichment


def _max_entities() -> int:
    try:
        return max(1, min(int(os.environ.get('MALTEGO_MAX_ENTITIES', '50')), 250))
    except ValueError:
        return 50


def _include_provider_nodes() -> bool:
    return os.environ.get('MALTEGO_INCLUDE_PROVIDER_NODES', '').strip().lower() in {'1', 'true', 'yes', 'on'}


def _add_spec(response, spec) -> None:
    entity = response.addEntity(spec.entity_type, spec.value)
    if spec.link_label:
        entity.setLinkLabel(spec.link_label)
    if spec.note:
        entity.setNote(spec.note)
    for key, value in list(spec.properties.items())[:8]:
        if value is None:
            continue
        entity.addProperty(str(key), str(key), 'loose', str(value)[:1024])


def execute_gateway_transform(request, response, indicator_type: str) -> None:
    try:
        client = GatewayClient.from_environment()
        result = client.enrich(request.Value, indicator_type)
    except GatewayConfigurationError as exc:
        response.addUIMessage(f'PARA11AX configuration error: {exc}', UIM_FATAL)
        return
    except GatewayError as exc:
        response.addUIMessage(f'PARA11AX request failed: {exc}', UIM_PARTIAL)
        return

    specs = map_enrichment(result, max_entities=_max_entities(), include_provider_nodes=_include_provider_nodes())
    for spec in specs:
        _add_spec(response, spec)

    status = result.get('status')
    failures = result.get('failures') if isinstance(result.get('failures'), list) else []
    if status == 'partial':
        names = sorted({str(item.get('provider')) for item in failures if isinstance(item, dict) and item.get('provider')})
        suffix = f" ({', '.join(names)})" if names else ''
        response.addUIMessage(f'CTI enrichment completed with partial provider coverage{suffix}.', UIM_PARTIAL)
    elif status == 'error':
        response.addUIMessage('CTI enrichment returned no successful provider evidence.', UIM_PARTIAL)
    elif not specs:
        response.addUIMessage('CTI enrichment succeeded but returned no graphable entities.', UIM_INFORM)
