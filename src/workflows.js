export const WORKFLOWS = Object.freeze({
  ip: Object.freeze(['ipinfo', 'rdap', 'ripestat', 'dshield', 'spamhaus-drop', 'tor-exit', 'feodo-tracker', 'threatminer', 'misp-circl-osint', 'misp-botvrij-osint', 'tweetfeed', 'ransomlook', 'greynoise', 'abuseipdb', 'shodan', 'censys', 'modat', 'cloudflare-radar', 'virustotal', 'otx', 'threatfox', 'urlscan', 'webamon', 'pulsedive']),
  domain: Object.freeze(['threatminer', 'openphish', 'misp-circl-osint', 'misp-botvrij-osint', 'tweetfeed', 'ransomlook', 'urlscan', 'webamon', 'modat', 'ransomware-live', 'virustotal', 'otx', 'threatfox', 'pulsedive']),
  url: Object.freeze(['openphish', 'threatminer', 'misp-circl-osint', 'misp-botvrij-osint', 'tweetfeed', 'ransomlook', 'urlscan', 'webamon', 'urlhaus', 'ransomware-live', 'virustotal', 'otx', 'threatfox', 'pulsedive']),
  hash: Object.freeze(['circl-hashlookup', 'threatminer', 'misp-circl-osint', 'misp-botvrij-osint', 'tweetfeed', 'ransomlook', 'malwarebazaar', 'malpedia', 'virustotal', 'hybrid-analysis', 'otx', 'threatfox']),
  cve: Object.freeze(['cisa-kev', 'epss', 'circl-vulnerability', 'misp-circl-osint', 'misp-botvrij-osint', 'nvd', 'osv', 'otx']),
  attack: Object.freeze(['attack-taxii']),
  asn: Object.freeze(['rdap', 'ripestat', 'spamhaus-drop']),
  cidr: Object.freeze(['rdap', 'ripestat', 'spamhaus-drop']),
});

export const WORKFLOW_CALL_LIMITS = Object.freeze({
  ip: 25,
  domain: 15,
  url: 15,
  hash: 15,
  cve: 12,
  attack: 2,
  asn: 4,
  cidr: 4,
});

export const WORKFLOW_BLUEPRINTS = WORKFLOWS;
