import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { invalidateRecommendationsCache } from '../services/recommendationsCache';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.get('/profile');
      setUser(res.data.data.user);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load profile';
      setError(msg);
      setUser(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (profileData) => {
    try {
      const res = await api.put('/profile', profileData);
      const updated = res.data.data.user;
      setUser(updated);
      invalidateRecommendationsCache();
      return { success: true, user: updated };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Update failed' };
    }
  }, []);

  return (
    <ProfileContext.Provider value={{ user, loading, error, fetchProfile, updateProfile, setUser }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
};
