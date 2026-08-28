from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform


@registry.register_transform(
    display_name='PARA11AX Enrich ASN',
    input_entity='maltego.Phrase',
    description='Enrich a canonical autonomous system number such as AS3333 through the private PARA11AX gateway.',
    output_entities=['maltego.AS', 'maltego.Phrase', 'maltego.Domain', 'maltego.IPv4Address', 'maltego.IPv6Address'],
)
class EnrichASN(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'asn')
