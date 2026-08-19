# cti-enrichment-gateway

Private, read-only CTI enrichment gateway for Vercel.

## Planned providers

- abuse.ch / ThreatFox
- AbuseIPDB
- GreyNoise
- VirusTotal
- Hybrid Analysis
- urlscan.io (historical search/result retrieval only; no scan submission)
- Sentry (monitoring only)

## Vercel environment variables

- `ABUSECH_API_KEY`
- `ABUSEIPDB_API_KEY`
- `GREYNOISE_API_KEY`
- `VIRUSTOTAL_API_KEY`
- `HYBRID_ANALYSIS_API_KEY`
- `URLSCAN_API_KEY`
- `SENTRY_AUTH_TOKEN`

Never commit API keys or other secrets to this repository.
