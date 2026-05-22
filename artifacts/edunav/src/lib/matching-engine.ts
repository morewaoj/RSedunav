import { useState, useEffect } from "react";
import { type College } from "@shared/schema";

export interface SearchCriteria {
  sport?: string;
  academicLevel?: string;
  location?: string;
  tuitionCap?: number;
  minAcceptanceRate?: number;
  minGraduationRate?: number;
}

interface MatchingEngineResult {
  searchResults: College[];
  isLoading: boolean;
  error: string | null;
  performSearch: (criteria: SearchCriteria) => Promise<void>;
}

export function useMatchingEngine(): MatchingEngineResult {
  const [searchResults, setSearchResults] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateMatchScore = (college: College, criteria: SearchCriteria): number => {
    let score = 0;
    let maxScore = 0;

    // Sport match (highest weight - 40 points)
    maxScore += 40;
    if (criteria.sport && college.sportsPrograms.includes(criteria.sport)) {
      score += 40;
    }

    // Academic level match (30 points)
    maxScore += 30;
    if (criteria.academicLevel) {
      if (college.academicLevel === criteria.academicLevel) {
        score += 30;
      } else if (
        (criteria.academicLevel === "medium" && college.academicLevel === "high") ||
        (criteria.academicLevel === "developing" && ["medium", "high"].includes(college.academicLevel))
      ) {
        score += 15; // Partial match for higher academic levels
      }
    }

    // Location match (20 points)
    maxScore += 20;
    if (criteria.location) {
      const locationLower = criteria.location.toLowerCase();
      const collegeLower = college.location.toLowerCase();
      
      if (collegeLower.includes(locationLower) || 
          college.city.toLowerCase().includes(locationLower) ||
          college.country.toLowerCase().includes(locationLower)) {
        score += 20;
      }
    }

    // Tuition filter (10 points)
    maxScore += 10;
    if (criteria.tuitionCap) {
      if (college.tuition <= criteria.tuitionCap) {
        score += 10;
      }
    } else {
      score += 10; // No preference means full points
    }

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  };

  const performSearch = async (criteria: SearchCriteria): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all colleges
      const response = await fetch('/api/colleges');
      if (!response.ok) {
        throw new Error('Failed to fetch colleges');
      }

      const allColleges: College[] = await response.json();

      // Apply filters and calculate match scores
      let filteredColleges = allColleges.filter(college => {
        // Apply hard filters first
        if (criteria.minAcceptanceRate && college.acceptanceRate < criteria.minAcceptanceRate) {
          return false;
        }
        
        if (criteria.minGraduationRate && college.graduationRate < criteria.minGraduationRate) {
          return false;
        }

        // Must have at least some relevance to be included
        const matchScore = calculateMatchScore(college, criteria);
        return matchScore > 20; // Only include colleges with at least 20% match
      });

      // Calculate match scores and sort by relevance
      const collegesWithScores = filteredColleges.map(college => ({
        ...college,
        matchScore: calculateMatchScore(college, criteria)
      }));

      // Sort by match score (highest first)
      collegesWithScores.sort((a, b) => b.matchScore - a.matchScore);

      setSearchResults(collegesWithScores);
    } catch (error) {
      console.error('Search failed:', error);
      setError(error instanceof Error ? error.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Load search results from localStorage on mount (for navigation back to results)
  useEffect(() => {
    const savedResults = localStorage.getItem('lastSearchResults');
    if (savedResults) {
      try {
        setSearchResults(JSON.parse(savedResults));
      } catch (error) {
        console.error('Failed to load saved results:', error);
      }
    }
  }, []);

  // Save search results to localStorage whenever they change
  useEffect(() => {
    if (searchResults.length > 0) {
      localStorage.setItem('lastSearchResults', JSON.stringify(searchResults));
    }
  }, [searchResults]);

  return {
    searchResults,
    isLoading,
    error,
    performSearch,
  };
}

// Utility function to get sport-specific matching criteria
export const getSportMatchingCriteria = (sport: string): Partial<SearchCriteria> => {
  const sportCriteria: Record<string, Partial<SearchCriteria>> = {
    soccer: {
      // Soccer is popular globally, good acceptance rates
      minAcceptanceRate: 30,
    },
    basketball: {
      // Basketball is competitive, might need higher academics
      minAcceptanceRate: 40,
    },
    swimming: {
      // Swimming often has good academic balance
      minAcceptanceRate: 35,
    },
    tennis: {
      // Tennis often associated with higher academic institutions
      minAcceptanceRate: 25,
    },
    hockey: {
      // Hockey popular in Canada, different regional preferences
      minAcceptanceRate: 40,
    },
  };

  return sportCriteria[sport] || {};
};

// Utility function to format location for search
export const formatLocationQuery = (location: string): string => {
  return location.trim().toLowerCase();
};

// Utility function to validate search criteria
export const validateSearchCriteria = (criteria: SearchCriteria): string[] => {
  const errors: string[] = [];

  if (!criteria.sport) {
    errors.push("Please select a sport");
  }

  if (!criteria.academicLevel) {
    errors.push("Please select your academic level");
  }

  if (criteria.tuitionCap && criteria.tuitionCap < 0) {
    errors.push("Tuition cap must be a positive number");
  }

  if (criteria.minAcceptanceRate && (criteria.minAcceptanceRate < 0 || criteria.minAcceptanceRate > 100)) {
    errors.push("Acceptance rate must be between 0 and 100");
  }

  if (criteria.minGraduationRate && (criteria.minGraduationRate < 0 || criteria.minGraduationRate > 100)) {
    errors.push("Graduation rate must be between 0 and 100");
  }

  return errors;
};
