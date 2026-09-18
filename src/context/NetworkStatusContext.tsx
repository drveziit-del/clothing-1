'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';

export type NetworkStatus = 'online' | 'offline' | 'back_online' | 'degraded';

interface NetworkStatusContextType {
  isOnline: boolean;
  isServerReachable: boolean;
  status: NetworkStatus;
  lastChecked: number | null;
  checkConnection: () => Promise<boolean>;
}

const NetworkStatusContext = createContext<NetworkStatusContextType>({
  isOnline: true,
  isServerReachable: true,
  status: 'online',
  lastChecked: null,
  checkConnection: async () => true,
});

export function NetworkStatusProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  const [isServerReachable, setIsServerReachable] = useState<boolean>(true);
  const [status, setStatus] = useState<NetworkStatus>('online');
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  const backOnlineTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  const clearBackOnlineTimer = () => {
    if (backOnlineTimerRef.current) {
      clearTimeout(backOnlineTimerRef.current);
      backOnlineTimerRef.current = null;
    }
  };

  /**
   * Probes backend health endpoint to confirm server availability
   */
  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return true;
    if (!navigator.onLine) {
      setIsOnline(false);
      setIsServerReachable(false);
      setStatus('offline');
      return false;
    }

    if (isCheckingRef.current) return isServerReachable;
    isCheckingRef.current = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/health', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const reachable = res.ok;
      setIsServerReachable(reachable);
      setLastChecked(Date.now());

      if (reachable) {
        setIsOnline(true);
        setStatus((prev) => (prev === 'offline' ? 'back_online' : 'online'));
        if (status === 'offline') {
          clearBackOnlineTimer();
          backOnlineTimerRef.current = setTimeout(() => {
            setStatus('online');
          }, 3500);
        }
      } else {
        setStatus('degraded');
      }

      return reachable;
    } catch {
      // Backend probe failed
      setIsServerReachable(false);
      setLastChecked(Date.now());
      setStatus(navigator.onLine ? 'degraded' : 'offline');
      return false;
    } finally {
      isCheckingRef.current = false;
    }
  }, [isServerReachable, status]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOffline = () => {
      clearBackOnlineTimer();
      setIsOnline(false);
      setIsServerReachable(false);
      setStatus('offline');
    };

    const handleOnline = async () => {
      setIsOnline(true);
      setStatus('back_online');

      // Verify server reachability upon reconnect
      const reachable = await checkConnection();
      if (reachable) {
        clearBackOnlineTimer();
        backOnlineTimerRef.current = setTimeout(() => {
          setStatus('online');
        }, 3500);
      } else {
        setStatus('degraded');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkConnection();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', checkConnection);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // If browser is initially offline on mount, update state immediately.
    // If online, do NOT fire a redundant health check probe during hydration.
    if (!navigator.onLine) {
      handleOffline();
    }

    // Periodic heartbeat check every 45 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkConnection();
      }
    }, 45000);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', checkConnection);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
      clearBackOnlineTimer();
    };
  }, [checkConnection]);

  const value = useMemo(
    () => ({
      isOnline: isOnline && isServerReachable,
      isServerReachable,
      status,
      lastChecked,
      checkConnection,
    }),
    [isOnline, isServerReachable, status, lastChecked, checkConnection]
  );

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkStatusContext);
}
