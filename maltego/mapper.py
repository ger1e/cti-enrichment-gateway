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


def _entity_value(kind: str | None, value: str) -> str:
    if (kind or '').lower() in {'asn', 'as'}:
        return value.upper().removeprefix('AS')
    return value


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
        if candidate in {'ip', 'ipv4', 'ipv6', 'domain', 'dns', 'url', 'hash', 'asn', 'cidr', 'actor', 'malware', 'cve'}:
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
        ('asn', 'asn', 'ASN'), ('cidr', 'cidr', 'CIDR'), ('queryCidr', 'cidr', 'CIDR'), ('prefix', 'cidr', 'prefix'),
        ('organization', 'phrase', 'organization'), ('org', 'phrase', 'organization'), ('name', 'phrase', 'registration'),
        ('country', 'phrase', 'country'), ('hostname', 'domain', 'hostname'), ('domain', 'domain', 'domain'),
        ('url', 'url', 'URL'), ('ip', 'ip', 'IP'), ('address', 'ip', 'IP'),
    ]
    for key, kind, label in candidates:
        value = _string(attributes.get(key))
        if not value:
            continue
        value = _entity_value(kind, value)
        if key == 'country':
            value = f'Country: {value.upper()}'
        specs.append(EntitySpec(_entity_type(kind, value), value, label, _note(result, provider), {'cti.provider': provider}))
    return specs


def _evidence_spec(item: dict, result: dict) -> EntitySpec:
    provider = _string(item.get('provider')) or 'unknown'
    observation = item.get('observation') if isinstance(item.get('observation'), dict) else {}
    kind = _string(observation.get('kind')) or 'enrichment'
    verdict = _string(observation.get('verdict')) or 'unknown'
    confidence = observation.get('confidence')
    suffix = f' ({confidence})' if isinstance(confidence, (int, float)) else ''
    properties = {'cti.provider': provider, 'cti.verdict': verdict, 'cti.kind': kind}
    integrity = item.get('integrity') if isinstance(item.get('integrity'), dict) else {}
    parser = _string(integrity.get('parserVersion'))
    fingerprint = _string(integrity.get('fingerprint'))
    cache_state = _string(item.get('cacheState'))
    retrieved = _string(item.get('retrievedAt'))
    if parser:
        properties['cti.parser_version'] = parser
    if fingerprint:
        properties['cti.fingerprint'] = fingerprint[:64]
    if cache_state:
        properties['cti.cache_state'] = cache_state
    if retrieved:
        properties['cti.retrieved_at'] = retrieved
    duration = item.get('durationMs')
    if isinstance(duration, (int, float)) and duration >= 0:
        properties['cti.duration_ms'] = str(duration)
    return EntitySpec('maltego.Phrase', f'{provider}: {kind} / {verdict}{suffix}', 'evidence', _note(result, provider), properties)


def _correlation_specs(result: dict) -> list[EntitySpec]:
    correlation = result.get('correlation') if isinstance(result.get('correlation'), dict) else {}
    specs: list[EntitySpec] = []
    for item in correlation.get('corroboration') or []:
        if not isinstance(item, dict):
            continue
        semantic = _string(item.get('semanticClass')) or 'unknown'
        polarity = _string(item.get('polarity')) or 'neutral'
        providers = [str(v) for v in (item.get('providers') or [])][:20]
        specs.append(EntitySpec('maltego.Phrase', f'Corroboration: {semantic} / {polarity} ({len(providers)} providers)', 'corroboration', _note(result), {'cti.semantic_class': semantic, 'cti.polarity': polarity, 'cti.providers': ','.join(providers)}))
    for item in correlation.get('contradictions') or []:
        if not isinstance(item, dict):
            continue
        semantic = _string(item.get('semanticClass')) or 'unknown'
        positive = ','.join(str(v) for v in (item.get('positiveProviders') or [])[:20])
        negative = ','.join(str(v) for v in (item.get('negativeProviders') or [])[:20])
        specs.append(EntitySpec('maltego.Phrase', f'Contradiction: {semantic}', 'contradiction', _note(result), {'cti.semantic_class': semantic, 'cti.positive_providers': positive, 'cti.negative_providers': negative}))
    freshness = correlation.get('freshness') if isinstance(correlation.get('freshness'), dict) else {}
    overall = _string(freshness.get('overall'))
    if overall:
        specs.append(EntitySpec('maltego.Phrase', f'Freshness: {overall}', 'freshness', _note(result), {'cti.freshness': overall}))
    huntability = correlation.get('huntability') if isinstance(correlation.get('huntability'), dict) else {}
    level = _string(huntability.get('level'))
    if level:
        properties = {'cti.huntability': level}
        reason = _string(huntability.get('reason'))
        if reason:
            properties['cti.reason'] = reason
        specs.append(EntitySpec('maltego.Phrase', f'Huntability: {level}', 'huntability', _note(result), properties))
    axes = correlation.get('riskAxes') if isinstance(correlation.get('riskAxes'), dict) else {}
    kev = axes.get('kev') if isinstance(axes.get('kev'), dict) else None
    if kev:
        state = 'listed' if kev.get('listed') is True else 'not listed'
        ransomware = _string(kev.get('ransomwareUse'))
        suffix = f' / ransomware {ransomware}' if ransomware else ''
        specs.append(EntitySpec('maltego.Phrase', f'KEV: {state}{suffix}', 'CVE risk', _note(result), {'cti.risk_axis': 'kev'}))
    epss = axes.get('epss') if isinstance(axes.get('epss'), dict) else None
    if epss and isinstance(epss.get('score'), (int, float)):
        percentile = epss.get('percentile')
        suffix = f' / percentile {percentile}' if isinstance(percentile, (int, float)) else ''
        specs.append(EntitySpec('maltego.Phrase', f"EPSS: {epss['score']}{suffix}", 'CVE risk', _note(result), {'cti.risk_axis': 'epss'}))
    cvss = axes.get('cvss') if isinstance(axes.get('cvss'), dict) else None
    if cvss and isinstance(cvss.get('score'), (int, float)):
        specs.append(EntitySpec('maltego.Phrase', f"CVSS: {cvss['score']}", 'CVE risk', _note(result), {'cti.risk_axis': 'cvss'}))
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
        value = _entity_value(kind, value)
        provider = _string(rel.get('provider')) or 'gateway'
        specs.append(EntitySpec(_entity_type(kind, value), value, relation[:80], _note(result, provider), {'cti.provider': provider, 'cti.relationship': relation}))

    specs.extend(_correlation_specs(result))

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
        integrity = item.get('integrity') if isinstance(item.get('integrity'), dict) else {}
        if include_provider_nodes or len(specs) == before or integrity.get('fingerprint'):
            specs.append(_evidence_spec(item, result))

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
