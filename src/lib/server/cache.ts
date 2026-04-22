type CacheRecord<T> = {
  expiresAt: number;
  value: T;
};

const inMemoryCache = new Map<string, CacheRecord<unknown>>();

export async function withCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = inMemoryCache.get(key);
  if (existing && existing.expiresAt > now) {
    return existing.value as T;
  }

  const value = await loader();
  inMemoryCache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}
