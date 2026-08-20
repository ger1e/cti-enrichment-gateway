from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform

@registry.register_transform(display_name='CTI Enrich URL', input_entity='maltego.URL', description='Enrich a URL through the private CTI enrichment gateway.', output_entities=['maltego.Domain','maltego.IPv4Address','maltego.IPv6Address','maltego.URL','maltego.Hash','maltego.Phrase'])
class EnrichURL(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'url')
