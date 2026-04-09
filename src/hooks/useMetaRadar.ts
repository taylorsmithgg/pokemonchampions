import { useState, useEffect, useMemo } from 'react';
import { fetchUsageStats, getCachedUsageStats } from '../data/liveData';
import { generateMetaReport, type MetaReport } from '../calc/metaRadar';

const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

export function useMetaRadar(): {
  report: MetaReport | null;
  loading: boolean;
  lastRefresh: Date | null;
  refresh: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [stats, setStats] = useState(getCachedUsageStats());

  const doRefresh = () => {
    setLoading(true);
    fetchUsageStats().then(data => {
      setStats(data);
      setLastRefresh(new Date());
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  // Initial fetch
  useEffect(() => {
    if (!stats) doRefresh();
    else setLastRefresh(new Date());
  }, []); // eslint-disable-line

  // Periodic refresh
  useEffect(() => {
    const interval = setInterval(doRefresh, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Generate report when data changes
  const report = useMemo(() => {
    return generateMetaReport(stats);
  }, [stats]);

  return { report, loading, lastRefresh, refresh: doRefresh };
}
