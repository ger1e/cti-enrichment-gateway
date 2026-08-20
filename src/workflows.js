export const WORKFLOWS = Object.freeze({
  ip: Object.freeze(['rdap']),
  cve: Object.freeze(['cisa-kev', 'epss']),
});

export const WORKFLOW_BLUEPRINTS = Object.freeze({
  ip: Object.freeze(['ipinfo', 'rdap', 'ripestat', 'greynoise', 'abuseipdb', 'shodan', 'censys', 'otx', 'threatfox', 'urlscan']),
  domain: Object.freeze(['rdap', 'urlscan', 'webamon', 'urlhaus', 'virustotal', 'otx', 'threatfox', 'censys']),
  url: Object.freeze(['urlscan', 'webamon', 'urlhaus', 'virustotal', 'otx', 'threatfox']),
  hash: Object.freeze(['circl-hashlookup', 'malwarebazaar', 'malpedia', 'virustotal', 'hybrid-analysis', 'otx', 'threatfox']),
  cve: Object.freeze(['cisa-kev', 'epss', 'nvd', 'osv']),
});
