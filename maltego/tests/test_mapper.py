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

if __name__ == '__main__':
    unittest.main()
