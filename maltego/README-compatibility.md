### Compatibility note

The integration intentionally uses `maltego-trx==1.7.0` for the Desktop Local Transform + generated MTZ path. Maltego archived the TRX repository in July 2026 and recommends the newer `maltego-transforms` SDK for new transform-server integrations. The current SDK is server/data-source oriented, while Graph Desktop continues to document Local Transforms and the TRX MTZ workflow remains supported for existing local integrations.

This adapter is isolated behind `gateway_client.py` and `mapper.py` so the Maltego transport can be replaced with the current SDK later without changing the PARA11AX contract or provider integrations.
