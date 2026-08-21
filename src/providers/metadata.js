const MIB = 1024 * 1024;
const MAX_BULK_FEED_BYTES = 32_000_000;

export const PROVIDER_METADATA = Object.freeze({
  ipinfo: { observationTypes: ['network_identity'], tier: 3, costClass: 'quota', maxResponseBytes: 2 * MIB, fixedHosts: ['api.ipinfo.io'], sourceUrl: 'https://ipinfo.io/developers' },
  rdap: { observationTypes: ['registration'], tier: 1, costClass: 'free', maxResponseBytes: 2 * MIB, fixedHosts: ['rdap.org'], sourceUrl: 'https://www.rdap.org/' },
  ripestat: { observationTypes: ['routing'], tier: 1, costClass: 'free', maxResponseBytes: 2 * MIB, fixedHosts: ['stat.ripe.net'], sourceUrl: 'https://stat.ripe.net/docs/data-api/' },
  dshield: { observationTypes: ['scanner_activity'], tier: 2, costClass: 'free', maxResponseBytes: 1 * MIB, fixedHosts: ['isc.sans.edu'], sourceUrl: 'https://isc.sans.edu/api/' },
  'spamhaus-drop': { observationTypes: ['drop_netblock'], tier: 2, costClass: 'free', maxResponseBytes: 2 * MIB, fixedHosts: ['www.spamhaus.org'], sourceUrl: 'https://www.spamhaus.org/blocklists/do-not-route-or-peer/' },
  'tor-exit': { observationTypes: ['tor_exit'], tier: 2, costClass: 'free', maxResponseBytes: 1 * MIB, fixedHosts: ['check.torproject.org'], sourceUrl: 'https://check.torproject.org/torbulkexitlist' },
  'feodo-tracker': { observationTypes: ['botnet_c2'], tier: 2, costClass: 'free', maxResponseBytes: 4 * MIB, fixedHosts: ['feodotracker.abuse.ch'], sourceUrl: 'https://feodotracker.abuse.ch/blocklist/' },
  threatminer: { observationTypes: ['passive_dns', 'malware_association', 'threat_context'], tier: 2, costClass: 'free', maxResponseBytes: 2 * MIB, fixedHosts: ['api.threatminer.org'], sourceUrl: 'https://www.threatminer.org/api.php' },
  'misp-circl-osint': { observationTypes: ['misp_feed_hit'], tier: 2, costClass: 'free', maxResponseBytes: MAX_BULK_FEED_BYTES, fixedHosts: ['www.circl.lu'], sourceUrl: 'https://www.circl.lu/doc/misp/feed-osint/' },
  'misp-botvrij-osint': { observationTypes: ['misp_feed_hit'], tier: 2, costClass: 'free', maxResponseBytes: MAX_BULK_FEED_BYTES, fixedHosts: ['www.botvrij.eu'], sourceUrl: 'https://www.botvrij.eu/data/feed-osint/' },
  greynoise: { observationTypes: ['internet_noise'], tier: 3, costClass: 'quota', maxResponseBytes: 2 * MIB, fixedHosts: ['api.greynoise.io'], sourceUrl: 'https://docs.greynoise.io/' },
  abuseipdb: { observationTypes: ['abuse_reports'], tier: 3, costClass: 'quota', maxResponseBytes: 2 * MIB, fixedHosts: ['api.abuseipdb.com'], sourceUrl: 'https://docs.abuseipdb.com/' },
  shodan: { observationTypes: ['internet_exposure'], tier: 3, costClass: 'quota', maxResponseBytes: 4 * MIB, fixedHosts: ['api.shodan.io'], sourceUrl: 'https://developer.shodan.io/api' },
  censys: { observationTypes: ['internet_exposure'], tier: 3, costClass: 'quota', maxResponseBytes: 8 * MIB, fixedHosts: ['api.platform.censys.io'], sourceUrl: 'https://docs.censys.com/reference/get-started' },
  'cloudflare-radar': { observationTypes: ['network_identity'], tier: 3, costClass: 'quota', maxResponseBytes: 2 * MIB, fixedHosts: ['api.cloudflare.com'], sourceUrl: 'https://developers.cloudflare.com/radar/' },
  virustotal: { observationTypes: ['reputation', 'malware_association'], tier: 3, costClass: 'quota', maxResponseBytes: 8 * MIB, fixedHosts: ['www.virustotal.com'], sourceUrl: 'https://docs.virustotal.com/reference/overview' },
  otx: { observationTypes: ['threat_context'], tier: 3, costClass: 'quota', maxResponseBytes: 8 * MIB, fixedHosts: ['otx.alienvault.com'], sourceUrl: 'https://otx.alienvault.com/api' },
  threatfox: { observationTypes: ['ioc_reputation'], tier: 3, costClass: 'quota', maxResponseBytes: 4 * MIB, fixedHosts: ['threatfox-api.abuse.ch'], sourceUrl: 'https://threatfox.abuse.ch/api/' },
  urlscan: { observationTypes: ['web_scan_history'], tier: 3, costClass: 'quota', maxResponseBytes: 8 * MIB, fixedHosts: ['urlscan.io'], sourceUrl: 'https://urlscan.io/docs/api/' },
  webamon: { observationTypes: ['web_intelligence'], tier: 3, costClass: 'quota', maxResponseBytes: 4 * MIB, fixedHosts: ['pro.webamon.com'], sourceUrl: 'https://pro.webamon.com/' },
  pulsedive: { observationTypes: ['threat_context'], tier: 3, costClass: 'quota', maxResponseBytes: 4 * MIB, fixedHosts: ['pulsedive.com'], sourceUrl: 'https://pulsedive.com/api/' },
  openphish: { observationTypes: ['phishing_feed'], tier: 2, costClass: 'free', maxResponseBytes: 8 * MIB, fixedHosts: ['raw.githubusercontent.com'], sourceUrl: 'https://openphish.com/phishing_feeds.html' },
  urlhaus: { observationTypes: ['malicious_url'], tier: 3, costClass: 'quota', maxResponseBytes: 4 * MIB, fixedHosts: ['urlhaus-api.abuse.ch'], sourceUrl: 'https://urlhaus.abuse.ch/api/' },
  'circl-hashlookup': { observationTypes: ['known_file'], tier: 1, costClass: 'free', maxResponseBytes: 2 * MIB, fixedHosts: ['hashlookup.circl.lu'], sourceUrl: 'https://hashlookup.circl.lu/' },
  malwarebazaar: { observationTypes: ['malware_sample_metadata'], tier: 3, costClass: 'quota', maxResponseBytes: 4 * MIB, fixedHosts: ['mb-api.abuse.ch'], sourceUrl: 'https://bazaar.abuse.ch/api/' },
  malpedia: { observationTypes: ['malware_catalog'], tier: 4, costClass: 'scarce', maxResponseBytes: 4 * MIB, fixedHosts: ['malpedia.caad.fkie.fraunhofer.de'], sourceUrl: 'https://malpedia.caad.fkie.fraunhofer.de/usage/api' },
  'hybrid-analysis': { observationTypes: ['sandbox_report'], tier: 4, costClass: 'scarce', maxResponseBytes: 8 * MIB, fixedHosts: ['www.hybrid-analysis.com'], sourceUrl: 'https://www.hybrid-analysis.com/docs/api/v2' },
  tweetfeed: { observationTypes: ['community_ioc_report'], tier: 2, costClass: 'free', maxResponseBytes: 2 * MIB, fixedHosts: ['api.tweetfeed.live'], sourceUrl: 'https://tweetfeed.live/api/' },
  ransomlook: { observationTypes: ['ransomware_post_reference'], tier: 2, costClass: 'free', maxResponseBytes: 4 * MIB, fixedHosts: ['www.ransomlook.io'], sourceUrl: 'https://www.ransomlook.io/doc' },
  'ransomware-live': { observationTypes: ['ransomware_victim_claim'], tier: 3, costClass: 'quota', maxResponseBytes: 4 * MIB, fixedHosts: ['api-pro.ransomware.live'], sourceUrl: 'https://api-pro.ransomware.live/docs' },
  'cisa-kev': { observationTypes: ['known_exploited'], tier: 1, costClass: 'free', maxResponseBytes: 8 * MIB, fixedHosts: ['www.cisa.gov'], sourceUrl: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' },
  epss: { observationTypes: ['exploit_probability'], tier: 1, costClass: 'free', maxResponseBytes: 2 * MIB, fixedHosts: ['api.first.org'], sourceUrl: 'https://www.first.org/epss/api' },
  'circl-vulnerability': { observationTypes: ['vulnerability_metadata'], tier: 1, costClass: 'free', maxResponseBytes: 8 * MIB, fixedHosts: ['vulnerability.circl.lu'], sourceUrl: 'https://vulnerability.circl.lu/api/' },
  nvd: { observationTypes: ['vulnerability_metadata'], tier: 2, costClass: 'quota', maxResponseBytes: 8 * MIB, fixedHosts: ['services.nvd.nist.gov'], sourceUrl: 'https://nvd.nist.gov/developers/vulnerabilities' },
  osv: { observationTypes: ['vulnerability_metadata'], tier: 2, costClass: 'free', maxResponseBytes: 4 * MIB, fixedHosts: ['api.osv.dev'], sourceUrl: 'https://google.github.io/osv.dev/api/' },
  'attack-taxii': { observationTypes: ['attack_knowledge'], tier: 5, costClass: 'free', maxResponseBytes: 24 * MIB, fixedHosts: ['attack-taxii.mitre.org'], sourceUrl: 'https://attack.mitre.org/resources/attack-data-and-tools/' },
});

export function withProviderMetadata(adapter) {
  const metadata = PROVIDER_METADATA[adapter?.name];
  if (!metadata) throw new Error(`missing static provider metadata: ${adapter?.name ?? 'unknown'}`);
  return Object.freeze({
    ...adapter,
    ...metadata,
    observationTypes: Object.freeze([...metadata.observationTypes]),
    fixedHosts: Object.freeze([...metadata.fixedHosts]),
  });
}
