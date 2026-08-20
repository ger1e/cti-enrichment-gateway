import { fetchJson } from '../core/fetch-json.js';

const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

export const cisaKevProvider = Object.freeze({
  name: 'cisa-kev',
  types: ['cve'],
  cacheTtlMs: 6 * 60 * 60 * 1000,
  negativeCacheTtlMs: 60 * 60 * 1000,
  costClass: 'free',
  timeoutMs: 7000,
  parserVersion: '1',
  async run(input, { signal, fetchImpl = fetch } = {}) {
    const raw = await fetchJson(KEV_URL, { fetchImpl, signal, maxBytes: 8_000_000 });
    const item = Array.isArray(raw.vulnerabilities) ? raw.vulnerabilities.find(v => v.cveID === input.value) : null;
    if (!item) {
      return {
        observationType: 'known_exploited',
        verdict: 'not_listed',
        confidence: 100,
        attributes: { cataloged: false },
        references: [KEV_URL],
      };
    }
    return {
      observationType: 'known_exploited',
      verdict: 'known_exploited',
      confidence: 100,
      firstSeen: item.dateAdded ?? null,
      attributes: {
        cataloged: true,
        vendorProject: item.vendorProject ?? null,
        product: item.product ?? null,
        vulnerabilityName: item.vulnerabilityName ?? null,
        dateAdded: item.dateAdded ?? null,
        dueDate: item.dueDate ?? null,
        knownRansomwareCampaignUse: item.knownRansomwareCampaignUse ?? null,
        requiredAction: item.requiredAction ?? null,
        notes: item.notes ?? null,
        cwes: Array.isArray(item.cwes) ? item.cwes : [],
      },
      references: [KEV_URL],
    };
  },
});
