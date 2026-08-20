from __future__ import annotations

import ipaddress
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class EntitySpec:
    entity_type: str
    value: str
    link_label: str = 'CTI'
    note: str = ''
    properties: dict[str, str] = field(default_factory=dict)


def _entity_type(kind: str | None, value: str) -> str:
    kind = (kind or '').lower()
    if kind in {'ip', 'ipv4', 'ipv6'}:
        try:
            addr = ipaddress.ip_address(value)
            return 'maltego.IPv4Address' if addr.version == 4 else 'maltego.IPv6Address'
        except ValueError:
            return 'maltego.Phrase'
    if kind in {'domain', 'dns', 'dnsname', 'hostname'}:
        return 'maltego.Domain'
    if kind == 'url':
        return 'maltego.URL'
    if kind in {'hash', 'sha256', 'sha1', 'md5'}:
        return 'maltego.Hash'
    if kind in {'asn', 'as'}:
        return 'maltego.AS'
    return 'maltego.Phrase'


def _string(value: Any) -> str | None:
    if value is None or isinstance(value, (dict, list, tuple, set)):
        return None
    text = str(value).strip()
    return text or None


def _target_from_relationship(rel: dict) -> tuple[str | None, str | None, str]:
    target = rel.get('target')
    target_kind = rel.get('targetType') or rel.get('target_type') or rel.get('entityType')
    if isinstance(target, dict):
        target_kind = target_kind or target.get('type') or target.get('kind')
        target_value = _string(target.get('value') or target.get('indicator') or target.get('id'))
    else:
        target_value = _string(target or rel.get('to') or rel.get('value') or rel.get('targetValue'))
    relation = _string(rel.get('relationship') or rel.get('relation') or rel.get('kind')) or 'related'
    if not target_kind and rel.get('type') not in {'relationship', 'edge'}:
        candidate = _string(rel.get('type'))
        if candidate in {'ip', 'ipv4', 'ipv6', 'domain', 'dns', 'url', 'hash', 'asn', 'actor', 'malware', 'cve'}:
            target_kind = candidate
    return _string(target_kind), target_value, relation


def _note(result: dict, provider: str | None = None) -> str:
    parts = []
    if provider:
        parts.append(f'Provider: {provider}')
    if result.get('requestId'):
        parts.append(f"Request: {result['requestId']}")
    if result.get('queriedAt'):
        parts.append(f"Queried: {result['queriedAt']}")
    return '\n'.join(parts)


def _attr_specs(attributes: dict, provider: str, result: dict) -> list[EntitySpec]:
    specs: list[EntitySpec] = []
    candidates = [
        ('asn', 'asn', 'ASN'), ('organization', 'phrase', 'organization'), ('org', 'phrase', 'organization'),
        ('name', 'phrase', 'registration'), ('country', 'phrase', 'country'), ('hostname', 'domain', 'hostname'),
        ('domain', 'domain', 'domain'), ('url', 'url', 'URL'), ('ip', 'ip', 'IP'), ('address', 'ip', 'IP'),
    ]
    for key, kind, label in candidates:
        value = _string(attributes.get(key))
        if not value:
            continue
        if key == 'asn':
            value = value.upper().removeprefix('AS')
        elif key == 'country':
            value = f'Country: {value.upper()}'
        specs.append(EntitySpec(_entity_type(kind, value), value, label, _note(result, provider), {'cti.provider': provider}))
    return specs


def map_enrichment(result: dict, max_entities: int = 50, include_provider_nodes: bool = False) -> list[EntitySpec]:
    if not isinstance(result, dict):
        return []
    max_entities = max(1, min(int(max_entities), 250))
    specs: list[EntitySpec] = []

    for rel in result.get('relationships') or []:
        if not isinstance(rel, dict):
            continue
        kind, value, relation = _target_from_relationship(rel)
        if not value:
            continue
        provider = _string(rel.get('provider')) or 'gateway'
        specs.append(EntitySpec(_entity_type(kind, value), value, relation[:80], _note(result, provider), {'cti.provider': provider, 'cti.relationship': relation}))

    hunt = result.get('huntContext') if isinstance(result.get('huntContext'), dict) else {}
    for family in hunt.get('families') or []:
        value = _string(family)
        if value:
            specs.append(EntitySpec('maltego.Phrase', value, 'malware family', _note(result), {'cti.kind': 'malware_family'}))
    for actor in hunt.get('actors') or []:
        value = _string(actor)
        if value:
            specs.append(EntitySpec('maltego.Phrase', value, 'actor', _note(result), {'cti.kind': 'actor'}))

    for item in result.get('evidence') or []:
        if not isinstance(item, dict):
            continue
        provider = _string(item.get('provider')) or 'unknown'
        observation = item.get('observation') if isinstance(item.get('observation'), dict) else {}
        attributes = observation.get('attributes') if isinstance(observation.get('attributes'), dict) else {}
        before = len(specs)
        specs.extend(_attr_specs(attributes, provider, result))
        family = _string(observation.get('malwareFamily'))
        actor = _string(observation.get('actor'))
        if family:
            specs.append(EntitySpec('maltego.Phrase', family, 'malware family', _note(result, provider), {'cti.provider': provider}))
        if actor:
            specs.append(EntitySpec('maltego.Phrase', actor, 'actor', _note(result, provider), {'cti.provider': provider}))
        if include_provider_nodes or len(specs) == before:
            kind = _string(observation.get('kind')) or 'enrichment'
            verdict = _string(observation.get('verdict')) or 'unknown'
            confidence = observation.get('confidence')
            suffix = f' ({confidence})' if isinstance(confidence, (int, float)) else ''
            specs.append(EntitySpec('maltego.Phrase', f'{provider}: {kind} / {verdict}{suffix}', 'evidence', _note(result, provider), {'cti.provider': provider, 'cti.verdict': verdict, 'cti.kind': kind}))

    deduped: list[EntitySpec] = []
    seen: set[tuple[str, str, str]] = set()
    for spec in specs:
        key = (spec.entity_type, spec.value.casefold(), spec.link_label.casefold())
        if key in seen:
            continue
        seen.add(key)
        deduped.append(spec)
        if len(deduped) >= max_entities:
            break
    return deduped
