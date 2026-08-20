export const WORKFLOWS = Object.freeze({
  ip: Object.freeze(['ipinfo', 'rdap', 'ripestat', 'dshield', 'spamhaus-drop', 'tor-exit', 'feodo-tracker', 'sslbl-c2', 'threatminer', 'greynoise', 'abuseipdb', 'shodan', 'censys', 'cloudflare-radar', 'virustotal', 'otx', 'threatfox', 'urlscan', 'webamon', 'pulsedive']),
  domain: Object.freeze(['rdap', 'threatminer', 'openphish', 'urlscan', 'webamon', 'virustotal', 'otx', 'threatfox', 'pulsedive']),
  url: Object.freeze(['openphish', 'threatminer', 'urlscan', 'webamon', 'urlhaus', 'virustotal', 'otx', 'threatfox', 'pulsedive']),
  hash: Object.freeze(['circl-hashlookup', 'threatminer', 'malwarebazaar', 'malpedia', 'virustotal', 'hybrid-analysis', 'otx', 'threatfox', 'pulsedive']),
  cve: Object.freeze(['cisa-kev', 'epss', 'circl-vulnerability', 'nvd', 'osv', 'otx']),
});

export const WORKFLOW_BLUEPRINTS = WORKFLOWS;
