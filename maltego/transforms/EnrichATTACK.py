from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform


@registry.register_transform(
    display_name='PARA11AX Enrich MITRE ATT&CK',
    input_entity='maltego.Phrase',
    description='Enrich a MITRE ATT&CK identifier such as T1059.001 or G0007 through the private PARA11AX gateway.',
    output_entities=['maltego.Phrase', 'maltego.URL'],
)
class EnrichATTACK(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'attack')
