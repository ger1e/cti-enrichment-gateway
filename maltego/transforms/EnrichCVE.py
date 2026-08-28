from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform

@registry.register_transform(display_name='PARA11AX Enrich CVE', input_entity='maltego.Phrase', description='Enrich a CVE identifier such as CVE-2026-1234 through the private PARA11AX gateway.', output_entities=['maltego.Phrase','maltego.URL'])
class EnrichCVE(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'cve')
