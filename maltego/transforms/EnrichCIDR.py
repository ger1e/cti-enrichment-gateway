from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform


@registry.register_transform(
    display_name='PARA11AX Enrich CIDR',
    input_entity='maltego.Phrase',
    description='Enrich a canonical IPv4 or IPv6 network prefix such as 192.0.2.0/24 through the private PARA11AX gateway.',
    output_entities=['maltego.Phrase', 'maltego.AS', 'maltego.IPv4Address', 'maltego.IPv6Address'],
)
class EnrichCIDR(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'cidr')
