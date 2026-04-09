import { useState, useEffect } from 'react';
import { fetchUsageStats, getCachedUsageStats, type UsageStats } from '../data/liveData';

interface LiveDataState {
  stats: UsageStats | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export function useLiveData(): LiveDataState {
  const [state, setState] = useState<LiveDataState>({
    stats: getCachedUsageStats(),
    loading: false,
    error: null,
    lastUpdated: null,
  });

  useEffect(() => {
    // Don't refetch if we have cached data
    if (state.stats) return;

    setState(prev => ({ ...prev, loading: true }));

    fetchUsageStats()
      .then(stats => {
        setState({
          stats,
          loading: false,
          error: stats ? null : 'Failed to fetch usage data',
          lastUpdated: stats ? new Date() : null,
        });
      })
      .catch(() => {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Network error fetching usage data',
        }));
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
