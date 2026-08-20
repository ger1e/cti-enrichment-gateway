from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform

@registry.register_transform(display_name='CTI Enrich IPv4', input_entity='maltego.IPv4Address', description='Enrich an IPv4 address through the private CTI enrichment gateway.', output_entities=['maltego.Domain','maltego.IPv4Address','maltego.AS','maltego.Phrase'])
class EnrichIPv4(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'ip')
