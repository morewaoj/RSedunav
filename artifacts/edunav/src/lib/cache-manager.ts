// Client-Side Caching System for Enhanced Performance
// First Layer: IndexedDB/LocalStorage for offline capability
// Second Layer: In-memory cache for ultra-fast access

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

export class CacheManager {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_PREFIX = 'edunav_';
  private readonly DEFAULT_TTL = 3600000; // 1 hour
  private readonly COLLEGE_TTL = 7200000; // 2 hours
  private readonly CAREER_TTL = 1800000; // 30 minutes
  private readonly SCHOLARSHIP_TTL = 3600000; // 1 hour

  // IndexedDB for persistent storage
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initIndexedDB();
  }

  private async initIndexedDB(): Promise<void> {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported, falling back to localStorage');
      return;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('EduNavCache', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores for different data types
        if (!db.objectStoreNames.contains('colleges')) {
          db.createObjectStore('colleges', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('careers')) {
          db.createObjectStore('careers', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('scholarships')) {
          db.createObjectStore('scholarships', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('userProfiles')) {
          db.createObjectStore('userProfiles', { keyPath: 'key' });
        }
      };
    });
  }

  // Get data with multi-layer caching
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.CACHE_PREFIX + key;
    
    // First check memory cache
    const memoryEntry = this.memoryCache.get(fullKey);
    if (memoryEntry && Date.now() < memoryEntry.expiry) {
      console.log(`Cache HIT (memory): ${key}`);
      return memoryEntry.data;
    }

    // Then check IndexedDB
    try {
      const persistentData = await this.getFromIndexedDB(fullKey);
      if (persistentData && Date.now() < persistentData.expiry) {
        console.log(`Cache HIT (IndexedDB): ${key}`);
        // Promote to memory cache
        this.memoryCache.set(fullKey, persistentData);
        return persistentData.data;
      }
    } catch (error) {
      console.warn('IndexedDB unavailable, checking localStorage');
    }

    // Finally check localStorage as fallback
    try {
      const localData = localStorage.getItem(fullKey);
      if (localData) {
        const parsed = JSON.parse(localData);
        if (Date.now() < parsed.expiry) {
          console.log(`Cache HIT (localStorage): ${key}`);
          // Promote to memory cache
          this.memoryCache.set(fullKey, parsed);
          return parsed.data;
        }
      }
    } catch (error) {
      console.warn('localStorage parsing error:', error);
    }

    console.log(`Cache MISS: ${key}`);
    return null;
  }

  // Set data with multi-layer caching
  async set<T>(key: string, data: T, customTTL?: number): Promise<void> {
    const fullKey = this.CACHE_PREFIX + key;
    const ttl = customTTL || this.getTTLForKey(key);
    const expiry = Date.now() + ttl;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry
    };

    // Store in memory cache
    this.memoryCache.set(fullKey, entry);

    // Store in IndexedDB
    try {
      await this.setInIndexedDB(fullKey, entry);
    } catch (error) {
      console.warn('IndexedDB storage failed, using localStorage fallback');
    }

    // Store in localStorage as fallback
    try {
      localStorage.setItem(fullKey, JSON.stringify(entry));
    } catch (error) {
      console.warn('localStorage storage failed:', error);
    }
  }

  // Bulk operations for pagination
  async getBulk<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    // Check what's available in cache first
    const missedKeys: string[] = [];
    
    for (const key of keys) {
      const cached = await this.get<T>(key);
      if (cached) {
        results.set(key, cached);
      } else {
        missedKeys.push(key);
      }
    }

    return results;
  }

  async setBulk<T>(entries: Map<string, T>, customTTL?: number): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const [key, data] of entries) {
      promises.push(this.set(key, data, customTTL));
    }
    
    await Promise.all(promises);
  }

  // Smart invalidation
  async invalidate(pattern: string): Promise<void> {
    const fullPattern = this.CACHE_PREFIX + pattern;
    
    // Clear from memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(fullPattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from IndexedDB
    try {
      const db = await this.dbPromise;
      if (db) {
        const stores = ['colleges', 'careers', 'scholarships', 'userProfiles'];
        for (const storeName of stores) {
          const transaction = db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.getAllKeys();
          
          request.onsuccess = () => {
            const keys = request.result as string[];
            for (const key of keys) {
              if (key.includes(fullPattern)) {
                store.delete(key);
              }
            }
          };
        }
      }
    } catch (error) {
      console.warn('IndexedDB invalidation failed');
    }

    // Clear from localStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(fullPattern)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('localStorage invalidation failed');
    }
  }

  // Preload critical data
  async preloadColleges(): Promise<void> {
    const cached = await this.get<any[]>('colleges_all');
    if (!cached) {
      try {
        const response = await fetch('/api/colleges');
        const colleges = await response.json();
        await this.set('colleges_all', colleges, this.COLLEGE_TTL);
        console.log(`Preloaded ${colleges.length} colleges to cache`);
      } catch (error) {
        console.warn('Failed to preload colleges:', error);
      }
    }
  }

  async preloadScholarships(): Promise<void> {
    const cached = await this.get<any[]>('scholarships_all');
    if (!cached) {
      try {
        const response = await fetch('/api/scholarships');
        const scholarships = await response.json();
        await this.set('scholarships_all', scholarships, this.SCHOLARSHIP_TTL);
        console.log(`Preloaded ${scholarships.length} scholarships to cache`);
      } catch (error) {
        console.warn('Failed to preload scholarships:', error);
      }
    }
  }

  // Background sync for user data
  async syncUserData(sessionId: string): Promise<void> {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`/api/saved-items/${sessionId}`);
      const userData = await response.json();
      
      await this.set(`user_data_${sessionId}`, userData, this.DEFAULT_TTL);
      console.log('User data synced to cache');
    } catch (error) {
      console.warn('Failed to sync user data:', error);
    }
  }

  // Cache statistics
  getCacheStats(): { memorySize: number; hitRate: string } {
    const memorySize = this.memoryCache.size;
    return {
      memorySize,
      hitRate: 'Tracking not implemented'
    };
  }

  // Clear all caches
  async clearAll(): Promise<void> {
    // Clear memory
    this.memoryCache.clear();
    
    // Clear IndexedDB
    try {
      const db = await this.dbPromise;
      if (db) {
        const stores = ['colleges', 'careers', 'scholarships', 'userProfiles'];
        for (const storeName of stores) {
          const transaction = db.transaction([storeName], 'readwrite');
          transaction.objectStore(storeName).clear();
        }
      }
    } catch (error) {
      console.warn('IndexedDB clear failed');
    }

    // Clear localStorage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('localStorage clear failed');
    }
  }

  private async getFromIndexedDB(key: string): Promise<CacheEntry<any> | null> {
    if (!this.dbPromise) return null;
    
    const db = await this.dbPromise;
    const storeName = this.getStoreNameForKey(key);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? { data: result.data, timestamp: result.timestamp, expiry: result.expiry } : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async setInIndexedDB(key: string, entry: CacheEntry<any>): Promise<void> {
    if (!this.dbPromise) return;
    
    const db = await this.dbPromise;
    const storeName = this.getStoreNameForKey(key);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put({ key, ...entry });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private getStoreNameForKey(key: string): string {
    if (key.includes('college')) return 'colleges';
    if (key.includes('career')) return 'careers';
    if (key.includes('scholarship')) return 'scholarships';
    if (key.includes('user')) return 'userProfiles';
    return 'colleges'; // default
  }

  private getTTLForKey(key: string): number {
    if (key.includes('college')) return this.COLLEGE_TTL;
    if (key.includes('career')) return this.CAREER_TTL;
    if (key.includes('scholarship')) return this.SCHOLARSHIP_TTL;
    return this.DEFAULT_TTL;
  }
}

export const cacheManager = new CacheManager();