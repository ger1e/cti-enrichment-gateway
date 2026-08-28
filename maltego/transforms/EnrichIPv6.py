from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform

@registry.register_transform(display_name='PARA11AX Enrich IPv6', input_entity='maltego.IPv6Address', description='Enrich an IPv6 address through the private PARA11AX gateway.', output_entities=['maltego.Domain','maltego.IPv6Address','maltego.AS','maltego.Phrase'])
class EnrichIPv6(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'ip')
