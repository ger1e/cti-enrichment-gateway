export const WORKFLOWS = Object.freeze({
  ip: Object.freeze(['ipinfo', 'rdap', 'ripestat', 'greynoise', 'abuseipdb', 'shodan', 'censys', 'cloudflare-radar', 'virustotal', 'otx', 'threatfox', 'urlscan', 'webamon', 'pulsedive']),
  domain: Object.freeze(['rdap', 'urlscan', 'webamon', 'virustotal', 'otx', 'threatfox', 'pulsedive']),
  url: Object.freeze(['urlscan', 'webamon', 'urlhaus', 'virustotal', 'otx', 'threatfox', 'pulsedive']),
  hash: Object.freeze(['circl-hashlookup', 'malwarebazaar', 'malpedia', 'virustotal', 'hybrid-analysis', 'otx', 'threatfox', 'pulsedive']),
  cve: Object.freeze(['cisa-kev', 'epss', 'nvd', 'osv', 'otx']),
});

export const WORKFLOW_BLUEPRINTS = WORKFLOWS;
