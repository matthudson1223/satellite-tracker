import { get, set } from 'idb-keyval';

interface CacheEntry<T> {
  fetchedAt: number;
  payload: T;
}

/** In-memory fallback when IndexedDB is unavailable (private mode, iOS quirks). */
const memCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

async function readEntry<T>(key: string): Promise<CacheEntry<T> | undefined> {
  try {
    const entry = await get<CacheEntry<T>>(key);
    if (entry) return entry;
  } catch {
    /* fall through to memory */
  }
  return memCache.get(key) as CacheEntry<T> | undefined;
}

async function writeEntry<T>(key: string, entry: CacheEntry<T>): Promise<void> {
  memCache.set(key, entry);
  try {
    await set(key, entry);
  } catch {
    /* memory-only is fine */
  }
}

export interface CachedResult<T> {
  payload: T;
  fetchedAt: number;
  /** True when served from cache past its TTL (refresh failed or still running). */
  stale: boolean;
}

/**
 * Stale-while-revalidate TTL cache.
 * - Fresh cache: returned immediately, no fetch.
 * - Stale cache: returned immediately, refresh kicked off in background
 *   (onRefresh called when it lands).
 * - No cache: fetch (deduped across callers), throw only if fetch fails.
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
  onRefresh?: (fresh: CachedResult<T>) => void,
): Promise<CachedResult<T>> {
  const entry = await readEntry<T>(key);
  const now = Date.now();

  if (entry && now - entry.fetchedAt < ttlMs) {
    return { payload: entry.payload, fetchedAt: entry.fetchedAt, stale: false };
  }

  const doFetch = (): Promise<T> => {
    let p = inFlight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = fetcher().finally(() => inFlight.delete(key));
      inFlight.set(key, p);
    }
    return p;
  };

  if (entry) {
    doFetch()
      .then(async (payload) => {
        const fresh = { fetchedAt: Date.now(), payload };
        await writeEntry(key, fresh);
        onRefresh?.({ payload, fetchedAt: fresh.fetchedAt, stale: false });
      })
      .catch(() => {
        /* keep serving stale */
      });
    return { payload: entry.payload, fetchedAt: entry.fetchedAt, stale: true };
  }

  const payload = await doFetch();
  const fresh = { fetchedAt: Date.now(), payload };
  await writeEntry(key, fresh);
  return { payload, fetchedAt: fresh.fetchedAt, stale: false };
}