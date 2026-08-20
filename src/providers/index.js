import { ipinfoProvider } from './ipinfo.js';
import { rdapProvider } from './rdap.js';
import { ripestatProvider } from './ripestat.js';
import { greynoiseProvider } from './greynoise.js';
import { abuseipdbProvider } from './abuseipdb.js';
import { shodanProvider } from './shodan.js';
import { censysProvider } from './censys.js';
import { cloudflareRadarProvider } from './cloudflare-radar.js';
import { virustotalProvider } from './virustotal.js';
import { otxProvider } from './otx.js';
import { threatfoxProvider } from './threatfox.js';
import { urlscanProvider } from './urlscan.js';
import { webamonProvider } from './webamon.js';
import { pulsediveProvider } from './pulsedive.js';
import { urlhausProvider } from './urlhaus.js';
import { circlHashlookupProvider } from './circl-hashlookup.js';
import { malwarebazaarProvider } from './malwarebazaar.js';
import { malpediaProvider } from './malpedia.js';
import { hybridAnalysisProvider } from './hybrid-analysis.js';
import { cisaKevProvider } from './cisa-kev.js';
import { epssProvider } from './epss.js';
import { nvdProvider } from './nvd.js';
import { osvProvider } from './osv.js';

export { ipinfoProvider, rdapProvider, ripestatProvider, greynoiseProvider, abuseipdbProvider, shodanProvider, censysProvider, cloudflareRadarProvider, virustotalProvider, otxProvider, threatfoxProvider, urlscanProvider, webamonProvider, pulsediveProvider, urlhausProvider, circlHashlookupProvider, malwarebazaarProvider, malpediaProvider, hybridAnalysisProvider, cisaKevProvider, epssProvider, nvdProvider, osvProvider };

export const ALL_PROVIDERS = Object.freeze([
  ipinfoProvider, rdapProvider, ripestatProvider, greynoiseProvider, abuseipdbProvider, shodanProvider, censysProvider, cloudflareRadarProvider,
  virustotalProvider, otxProvider, threatfoxProvider, urlscanProvider, webamonProvider, pulsediveProvider, urlhausProvider,
  circlHashlookupProvider, malwarebazaarProvider, malpediaProvider, hybridAnalysisProvider, cisaKevProvider, epssProvider, nvdProvider, osvProvider,
]);
