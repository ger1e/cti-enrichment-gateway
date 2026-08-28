from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform

@registry.register_transform(display_name='PARA11AX Enrich DNS Name', input_entity='maltego.DNSName', description='Enrich a DNS name through the private PARA11AX gateway.', output_entities=['maltego.Domain','maltego.IPv4Address','maltego.IPv6Address','maltego.URL','maltego.Hash','maltego.Phrase'])
class EnrichDNSName(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'domain')
