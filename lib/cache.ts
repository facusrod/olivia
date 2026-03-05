const TTL_MS = 60 * 60 * 1000; // 1 hora

type CacheEntry<T> = { data: T; expiresAt: number };

let lowStockCache: CacheEntry<any[]> | null = null;
let topSellersCache: CacheEntry<any> | null = null;

export async function getCachedLowStock<T>(fetchFn: () => Promise<T[]>): Promise<T[]> {
  if (lowStockCache && Date.now() < lowStockCache.expiresAt) {
    return lowStockCache.data;
  }
  const data = await fetchFn();
  lowStockCache = { data, expiresAt: Date.now() + TTL_MS };
  return data;
}

export async function getCachedTopSellers<T>(fetchFn: () => Promise<T>): Promise<T> {
  if (topSellersCache && Date.now() < topSellersCache.expiresAt) {
    return topSellersCache.data;
  }
  const data = await fetchFn();
  topSellersCache = { data, expiresAt: Date.now() + TTL_MS };
  return data;
}

export function invalidateCache() {
  lowStockCache = null;
  topSellersCache = null;
}
