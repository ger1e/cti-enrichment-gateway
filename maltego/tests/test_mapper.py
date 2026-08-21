import unittest
from mapper import map_enrichment

class MapperTests(unittest.TestCase):
    def test_maps_relationships_hunt_context_and_attributes(self):
        result = {'requestId':'abc','queriedAt':'2026-08-20T13:00:00Z','relationships':[{'provider':'urlscan','targetType':'domain','target':'evil.example','relationship':'resolves-to'},{'provider':'censys','target':{'type':'ip','value':'203.0.113.10'},'relation':'hosted-on'}],'huntContext':{'families':['ExampleRAT'],'actors':['Example Actor']},'evidence':[{'provider':'rdap','observation':{'kind':'registration','verdict':'unknown','attributes':{'name':'EXAMPLE-NET','country':'hu','asn':'AS64500'}}}]}
        specs = map_enrichment(result, max_entities=50)
        pairs = {(s.entity_type, s.value, s.link_label) for s in specs}
        self.assertIn(('maltego.Domain','evil.example','resolves-to'), pairs)
        self.assertIn(('maltego.IPv4Address','203.0.113.10','hosted-on'), pairs)
        self.assertIn(('maltego.Phrase','ExampleRAT','malware family'), pairs)
        self.assertIn(('maltego.Phrase','Example Actor','actor'), pairs)
        self.assertIn(('maltego.AS','64500','ASN'), pairs)
        self.assertIn(('maltego.Phrase','Country: HU','country'), pairs)

    def test_emits_provider_summary_when_evidence_has_no_graphable_attributes(self):
        result = {'evidence':[{'provider':'epss','observation':{'kind':'exploit_probability','verdict':'unknown','confidence':0.81,'attributes':{}}}]}
        specs = map_enrichment(result)
        self.assertEqual(len(specs),1)
        self.assertEqual(specs[0].value,'epss: exploit_probability / unknown (0.81)')
        self.assertEqual(specs[0].link_label,'evidence')

    def test_deduplicates_and_enforces_budget(self):
        result = {'relationships':[{'targetType':'domain','target':'a.example','relationship':'related'},{'targetType':'domain','target':'a.example','relationship':'related'},{'targetType':'domain','target':'b.example','relationship':'related'}]}
        specs = map_enrichment(result, max_entities=1)
        self.assertEqual(len(specs),1)
        self.assertEqual(specs[0].value,'a.example')

    def test_v2_correlation_freshness_huntability_and_cve_axes_map_to_bounded_phrase_nodes(self):
        result = {
            'requestId':'r2','queriedAt':'2026-08-21T01:00:00Z',
            'correlation': {
                'corroboration':[{'semanticClass':'reputation','polarity':'positive','providers':['a','b']}],
                'contradictions':[{'semanticClass':'reputation','providers':['a','c'],'positiveProviders':['a'],'negativeProviders':['c']}],
                'freshness':{'overall':'current'},
                'huntability':{'level':'high','reason':'direct_network_or_url_search'},
                'riskAxes':{'kev':{'listed':True,'ransomwareUse':'Known','provider':'cisa-kev'},'epss':{'score':0.81,'percentile':0.98,'provider':'epss'},'cvss':{'score':8.8,'provider':'nvd'}},
            },
            'evidence':[], 'relationships':[],
        }
        specs = map_enrichment(result, max_entities=50)
        values = {spec.value for spec in specs}
        self.assertIn('Corroboration: reputation / positive (2 providers)', values)
        self.assertIn('Contradiction: reputation', values)
        self.assertIn('Freshness: current', values)
        self.assertIn('Huntability: high', values)
        self.assertIn('KEV: listed / ransomware Known', values)
        self.assertIn('EPSS: 0.81 / percentile 0.98', values)
        self.assertIn('CVSS: 8.8', values)

    def test_v2_evidence_provenance_is_graphable_without_leaking_raw_hash(self):
        result = {
            'requestId':'r3','queriedAt':'2026-08-21T01:00:00Z','relationships':[],
            'evidence':[{
                'provider':'rdap','retrievedAt':'2026-08-21T00:59:00Z','cacheState':'hit','durationMs':0,
                'integrity':{'parserVersion':'2026-08-21','fingerprint':'f'*64,'rawHash':'deadbeef'},
                'observation':{'kind':'registration','verdict':'unknown','confidence':None,'attributes':{'country':'HU'}},
            }]
        }
        specs = map_enrichment(result, max_entities=50)
        evidence = [spec for spec in specs if spec.link_label == 'evidence' and spec.value.startswith('rdap:')]
        self.assertEqual(len(evidence), 1)
        self.assertEqual(evidence[0].properties['cti.parser_version'], '2026-08-21')
        self.assertEqual(evidence[0].properties['cti.fingerprint'], 'f'*64)
        self.assertEqual(evidence[0].properties['cti.cache_state'], 'hit')
        self.assertNotIn('rawHash', evidence[0].properties)
        self.assertNotIn('deadbeef', str(evidence[0].properties))

    def test_cidr_relationship_stays_phrase_and_asn_uses_stable_as_entity(self):
        result = {'relationships':[{'targetType':'cidr','target':'192.0.2.0/24','relation':'related-prefix'},{'targetType':'asn','target':'AS3333','relation':'origin'}]}
        specs = map_enrichment(result)
        pairs = {(s.entity_type, s.value) for s in specs}
        self.assertIn(('maltego.Phrase','192.0.2.0/24'), pairs)
        self.assertIn(('maltego.AS','3333'), pairs)

if __name__ == '__main__':
    unittest.main()
