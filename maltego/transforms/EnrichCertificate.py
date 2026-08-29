from maltego_trx.transform import DiscoverableTransform
from extensions import registry
from transforms.common import execute_gateway_transform


@registry.register_transform(
    display_name='PARA11AX Enrich Certificate',
    input_entity='maltego.Hash',
    description='Enrich an X.509 certificate SHA-256 fingerprint through the private PARA11AX gateway.',
    output_entities=['maltego.Domain', 'maltego.URL', 'maltego.Phrase'],
)
class EnrichCertificate(DiscoverableTransform):
    @classmethod
    def create_entities(cls, request, response):
        execute_gateway_transform(request, response, 'certificate')
