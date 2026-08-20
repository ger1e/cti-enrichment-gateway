from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform

@registry.register_transform(display_name='CTI Enrich Hash', input_entity='maltego.Hash', description='Enrich a file hash through the private CTI enrichment gateway.', output_entities=['maltego.Hash','maltego.Domain','maltego.IPv4Address','maltego.IPv6Address','maltego.URL','maltego.Phrase'])
class EnrichHash(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'hash')
