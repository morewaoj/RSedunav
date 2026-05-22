// Session Management Hook with Comprehensive Save/Sync
import { useState, useEffect } from 'react';
import { cacheManager } from '@/lib/cache-manager';

interface UserSession {
  sessionId: string;
  isLoading: boolean;
  lastSync: string | null;
}

export function useSession() {
  const [session, setSession] = useState<UserSession>({
    sessionId: '',
    isLoading: true,
    lastSync: null
  });

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      // Check for existing session
      let sessionId = localStorage.getItem('edunav_session_id');
      
      if (!sessionId) {
        // Generate new session ID
        sessionId = generateSessionId();
        localStorage.setItem('edunav_session_id', sessionId);
      }

      // Initialize cache preloading
      await Promise.all([
        cacheManager.preloadColleges(),
        cacheManager.preloadScholarships()
      ]);

      // Sync user data if session exists
      if (sessionId) {
        await cacheManager.syncUserData(sessionId);
      }

      setSession({
        sessionId,
        isLoading: false,
        lastSync: new Date().toISOString()
      });

    } catch (error) {
      console.error('Session initialization failed:', error);
      setSession(prev => ({ ...prev, isLoading: false }));
    }
  };

  const saveItem = async (type: 'college' | 'career' | 'scholarship', data: any) => {
    if (!session.sessionId) return;

    try {
      const endpoint = `/api/saved-${type}s`;
      const payload = {
        ...data,
        sessionId: session.sessionId
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Invalidate cache to force refresh
        await cacheManager.invalidate(`user_data_${session.sessionId}`);
        console.log(`${type} saved successfully`);
        return true;
      }
    } catch (error) {
      console.error(`Failed to save ${type}:`, error);
    }
    return false;
  };

  const getSavedItems = async () => {
    if (!session.sessionId) return null;

    try {
      // Check cache first
      const cached = await cacheManager.get(`user_data_${session.sessionId}`);
      if (cached) {
        return cached;
      }

      // Fetch from API
      const response = await fetch(`/api/saved-items/${session.sessionId}`);
      if (response.ok) {
        const data = await response.json();
        await cacheManager.set(`user_data_${session.sessionId}`, data);
        return data;
      }
    } catch (error) {
      console.error('Failed to get saved items:', error);
    }
    return null;
  };

  const clearSession = async () => {
    localStorage.removeItem('edunav_session_id');
    await cacheManager.clearAll();
    setSession({
      sessionId: '',
      isLoading: false,
      lastSync: null
    });
  };

  return {
    session,
    saveItem,
    getSavedItems,
    clearSession,
    isAuthenticated: !!session.sessionId
  };
}

function generateSessionId(): string {
  return 'session_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}