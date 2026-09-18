/**
 * A very small TTL cache with an LRU-ish eviction policy.
 *
 * The DB API rate-limits per client IP, and on a free Render instance every
 * visitor shares one IP — so without this, twenty people watching the same
 * departure board is twenty times the upstream traffic. Entries are keyed by
 * the fully-built upstream URL, so identical requests collapse into one.
 */
export class TtlCache {
  constructor({ maxEntries = 500 } = {}) {
    this.maxEntries = maxEntries;
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    // Re-insert so the most recently used key sits at the end of the Map.
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key, value, ttlMs) {
    if (!ttlMs || ttlMs <= 0) return;
    if (this.map.size >= this.maxEntries) {
      // Map preserves insertion order, so the first key is the coldest.
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      entries: this.map.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total ? Number((this.hits / total).toFixed(3)) : 0,
    };
  }
}
