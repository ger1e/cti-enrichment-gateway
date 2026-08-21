from maltego_trx.decorator_registry import TransformRegistry

registry = TransformRegistry(
    owner='CTI Enrichment Gateway',
    author='ger1e',
    host_url='https://cti-enrichment-gateway.vercel.app',
    seed_ids=['cti-enrichment-gateway'],
)
registry.version = '2.0.0'
registry.display_name_suffix = ' [CTI Gateway]'
