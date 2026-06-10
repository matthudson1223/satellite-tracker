import { getCached } from './cache';

export interface Transmitter {
  description: string;
  type: string;
  status: string; // active | inactive | invalid
  mode: string | null;
  baud: number | null;
  downlinkLowHz: number | null;
  downlinkHighHz: number | null;
  uplinkLowHz: number | null;
  uplinkHighHz: number | null;
  invert: boolean;
  service: string | null;
}

interface SatnogsTransmitterRaw {
  description: string;
  type: string;
  status: string;
  mode: string | null;
  baud: number | null;
  downlink_low: number | null;
  downlink_high: number | null;
  uplink_low: number | null;
  uplink_high: number | null;
  invert: boolean;
  service: string | null;
  alive: boolean;
}

const TTL_MS = 24 * 3600_000;

export function mapTransmitters(raw: SatnogsTransmitterRaw[]): Transmitter[] {
  return raw
    .filter((t) => t.status !== 'invalid')
    .map((t) => ({
      description: t.description,
      type: t.type,
      status: t.status,
      mode: t.mode,
      baud: t.baud,
      downlinkLowHz: t.downlink_low,
      downlinkHighHz: t.downlink_high,
      uplinkLowHz: t.uplink_low,
      uplinkHighHz: t.uplink_high,
      invert: t.invert,
      service: t.service,
    }))
    .sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1));
}

export async function fetchTransmitters(noradId: number): Promise<Transmitter[]> {
  const { payload } = await getCached<SatnogsTransmitterRaw[]>(
    `satnogs:${noradId}`,
    async () => {
      const res = await fetch(
        `https://db.satnogs.org/api/transmitters/?satellite__norad_cat_id=${noradId}&format=json`,
      );
      if (!res.ok) throw new Error(`SatNOGS: HTTP ${res.status}`);
      return (await res.json()) as SatnogsTransmitterRaw[];
    },
    TTL_MS,
  );
  return mapTransmitters(payload);
}

export function formatFrequency(hz: number | null): string {
  if (hz == null) return '—';
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(4)} GHz`;
  return `${(hz / 1e6).toFixed(3)} MHz`;
}