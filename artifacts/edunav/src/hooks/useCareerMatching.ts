// Enhanced Career Matching Hook with ML-based O*NET Integration
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cacheManager } from '@/lib/cache-manager';

interface UserProfile {
  interests: string[];
  skills: string[];
  preferredEducation: string;
  gpa?: number;
  salaryExpectation?: number;
  locationPreference?: string;
  workValues?: string[];
}

interface CareerMatch {
  title: string;
  onetCode: string;
  matchScore: number;
  confidence: number;
  salary: {
    median: number;
    range: string;
  };
  education: string;
  growth: string;
  matchReasons: string[];
  skillsGap: string[];
  standOutTips: string[];
}

export function useCareerMatching() {
  const [isMatching, setIsMatching] = useState(false);
  const queryClient = useQueryClient();

  const careerMatchMutation = useMutation({
    mutationFn: async (userProfile: UserProfile): Promise<CareerMatch[]> => {
      setIsMatching(true);
      
      // Check cache first for repeated profiles
      const cacheKey = `career_matches_${JSON.stringify(userProfile).slice(0, 50)}`;
      const cached = await cacheManager.get<CareerMatch[]>(cacheKey);
      
      if (cached) {
        console.log('Using cached career matches');
        setIsMatching(false);
        return cached;
      }

      // Call enhanced ML-based matching API
      const response = await fetch('/api/career-paths/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userProfile)
      });

      if (!response.ok) {
        throw new Error('Career matching failed');
      }

      const matches = await response.json();
      
      // Cache results for 30 minutes
      await cacheManager.set(cacheKey, matches, 1800000);
      
      setIsMatching(false);
      return matches;
    },
    onSuccess: (data) => {
      console.log(`Found ${data.length} career matches with ML confidence scores`);
    },
    onError: (error) => {
      console.error('Career matching error:', error);
      setIsMatching(false);
    }
  });

  const findCareerMatches = async (userProfile: UserProfile) => {
    return careerMatchMutation.mutateAsync(userProfile);
  };

  const getTopCareersByInterest = async (interests: string[]) => {
    const profile: UserProfile = {
      interests,
      skills: [],
      preferredEducation: "Bachelor's degree"
    };
    
    const matches = await findCareerMatches(profile);
    return matches.slice(0, 5); // Top 5 matches
  };

  return {
    findCareerMatches,
    getTopCareersByInterest,
    isMatching: isMatching || careerMatchMutation.isPending,
    error: careerMatchMutation.error,
    lastMatches: careerMatchMutation.data
  };
}