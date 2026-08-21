export const WORKFLOWS = Object.freeze({
  ip: Object.freeze(['ipinfo', 'rdap', 'ripestat', 'dshield', 'spamhaus-drop', 'tor-exit', 'feodo-tracker', 'threatminer', 'misp-circl-osint', 'misp-botvrij-osint', 'greynoise', 'abuseipdb', 'shodan', 'censys', 'cloudflare-radar', 'virustotal', 'otx', 'threatfox', 'urlscan', 'webamon', 'pulsedive']),
  domain: Object.freeze(['rdap', 'threatminer', 'openphish', 'misp-circl-osint', 'misp-botvrij-osint', 'urlscan', 'webamon', 'virustotal', 'otx', 'threatfox', 'pulsedive']),
  url: Object.freeze(['openphish', 'threatminer', 'misp-circl-osint', 'misp-botvrij-osint', 'urlscan', 'webamon', 'urlhaus', 'virustotal', 'otx', 'threatfox', 'pulsedive']),
  hash: Object.freeze(['circl-hashlookup', 'threatminer', 'misp-circl-osint', 'misp-botvrij-osint', 'malwarebazaar', 'malpedia', 'virustotal', 'hybrid-analysis', 'otx', 'threatfox', 'pulsedive']),
  cve: Object.freeze(['cisa-kev', 'epss', 'circl-vulnerability', 'misp-circl-osint', 'misp-botvrij-osint', 'nvd', 'osv', 'otx']),
  attack: Object.freeze(['attack-taxii']),
});

export const WORKFLOW_BLUEPRINTS = WORKFLOWS;
