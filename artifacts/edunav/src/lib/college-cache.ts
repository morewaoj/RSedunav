import type { College } from "@shared/schema";

const CACHE_KEY = 'colleges_cache';
const CACHE_TIMESTAMP_KEY = 'colleges_cache_timestamp';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export class CollegeCache {
  static async getColleges(): Promise<College[] | null> {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      
      if (!cached || !timestamp) return null;
      
      const age = Date.now() - parseInt(timestamp);
      if (age > CACHE_DURATION) {
        this.clearCache();
        return null;
      }
      
      return JSON.parse(cached);
    } catch {
      return null;
    }
  }

  static async cacheColleges(colleges: College[]): Promise<void> {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(colleges));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.warn('Failed to cache colleges:', error);
    }
  }

  static clearCache(): void {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  }

  static async searchCached(query: string): Promise<College[]> {
    const cached = await this.getColleges();
    if (!cached) return [];

    const searchTerm = query.toLowerCase();
    return cached.filter(college => 
      college.name.toLowerCase().includes(searchTerm) ||
      college.city.toLowerCase().includes(searchTerm) ||
      college.state?.toLowerCase().includes(searchTerm)
    );
  }

  static async filterCached(filters: {
    state?: string;
    type?: string;
    sport?: string;
    minTuition?: number;
    maxTuition?: number;
    minAcceptance?: number;
    maxAcceptance?: number;
  }): Promise<College[]> {
    const cached = await this.getColleges();
    if (!cached) return [];

    return cached.filter(college => {
      if (filters.state && filters.state !== 'all-states' && college.state !== filters.state) return false;
      if (filters.type && filters.type !== 'all-types' && college.type !== filters.type) return false;
      if (filters.sport && filters.sport !== 'all-sports' && !college.sportsPrograms.includes(filters.sport)) return false;
      if (filters.minTuition && college.tuition < filters.minTuition) return false;
      if (filters.maxTuition && college.tuition > filters.maxTuition) return false;
      if (filters.minAcceptance && college.acceptanceRate < filters.minAcceptance) return false;
      if (filters.maxAcceptance && college.acceptanceRate > filters.maxAcceptance) return false;
      
      return true;
    });
  }
}