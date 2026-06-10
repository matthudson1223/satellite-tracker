import { getCached } from './cache';

/** Subset of SATCAT fields we display. */
export interface SatcatEntry {
  objectType: string; // PAY, R/B, DEB, UNK
  country: string;
  launchDate: string;
  launchSite: string;
  decayDate: string;
}

const SATCAT_URL = 'https://celestrak.org/pub/satcat.csv';
const SATCAT_TTL_MS = 7 * 24 * 3600_000;

/** Minimal CSV line parser handling quoted fields with commas. */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

export function parseSatcatCsv(csv: string): Map<number, SatcatEntry> {
  const lines = csv.split('\n');
  const header = parseCsvLine(lines[0]);
  const col = (name: string) => header.indexOf(name);
  const iNorad = col('NORAD_CAT_ID');
  const iType = col('OBJECT_TYPE');
  const iCountry = col('OWNER');
  const iLaunch = col('LAUNCH_DATE');
  const iSite = col('LAUNCH_SITE');
  const iDecay = col('DECAY_DATE');

  const map = new Map<number, SatcatEntry>();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const f = parseCsvLine(lines[i]);
    const norad = parseInt(f[iNorad], 10);
    if (!Number.isFinite(norad)) continue;
    map.set(norad, {
      objectType: f[iType] ?? '',
      country: f[iCountry] ?? '',
      launchDate: f[iLaunch] ?? '',
      launchSite: f[iSite] ?? '',
      decayDate: f[iDecay] ?? '',
    });
  }
  return map;
}

export async function fetchSatcat(): Promise<Map<number, SatcatEntry>> {
  const { payload } = await getCached<string>(
    'satcat:csv',
    async () => {
      const res = await fetch(SATCAT_URL);
      if (!res.ok) throw new Error(`SATCAT: HTTP ${res.status}`);
      return res.text();
    },
    SATCAT_TTL_MS,
  );
  return parseSatcatCsv(payload);
}