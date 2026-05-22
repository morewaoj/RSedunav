import { useState, useCallback, useEffect } from 'react';

interface LikedCollege {
  id: number;
  name: string;
  city?: string;
  state?: string;
  tuition?: number;
  tuitionInState?: number;
  website?: string;
}

const STORAGE_KEY = 'likedColleges';

export function useLikedColleges() {
  const [likedColleges, setLikedColleges] = useState<LikedCollege[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync with localStorage whenever likedColleges changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(likedColleges));
  }, [likedColleges]);

  const toggleLikedCollege = useCallback((college: LikedCollege) => {
    setLikedColleges(prev => {
      const isLiked = prev.some(c => c.id === college.id);
      return isLiked 
        ? prev.filter(c => c.id !== college.id)
        : [...prev, college];
    });
  }, []);

  const isLiked = useCallback((collegeId: number) => {
    return likedColleges.some(c => c.id === collegeId);
  }, [likedColleges]);

  const removeLikedCollege = useCallback((collegeId: number) => {
    setLikedColleges(prev => prev.filter(c => c.id !== collegeId));
  }, []);

  return {
    likedColleges,
    toggleLikedCollege,
    isLiked,
    removeLikedCollege,
    likedCount: likedColleges.length
  };
}
