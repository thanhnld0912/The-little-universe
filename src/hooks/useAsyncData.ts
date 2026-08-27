/**
 * Loads something once, and again on demand.
 *
 * The views need the same three states — loading, failed, loaded — and a way to
 * ask for the data again when the refresh control is used. Keeping that in one
 * hook stops each view inventing its own slightly different version.
 *
 * `reload` re-fetches; it does not ask the server for a *new* reading. The
 * backend stores one reading per visitor per day, so this returns what you were
 * already given rather than rewriting your day.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncData<T> {
  data: T | undefined;
  error: string | undefined;
  isLoading: boolean;
  /** True only while a reload is in flight, so the first load can look different. */
  isReloading: boolean;
  reload: () => void;
}

export function useAsyncData<T>(load: () => Promise<T>): AsyncData<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isReloading, setIsReloading] = useState(false);

  // A view can unmount mid-request; setting state afterwards would warn and,
  // worse, resurrect a stale response over a newer one.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // `load` is typically an inline arrow, so it is a new function every render.
  // Holding it in a ref keeps `run` stable and prevents an endless fetch loop.
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (isReload: boolean) => {
    if (isReload) setIsReloading(true);
    else setIsLoading(true);
    setError(undefined);

    try {
      const result = await loadRef.current();
      if (!alive.current) return;
      setData(result);
    } catch (caught) {
      if (!alive.current) return;
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      if (alive.current) {
        setIsLoading(false);
        setIsReloading(false);
      }
    }
  }, []);

  useEffect(() => {
    void run(false);
  }, [run]);

  const reload = useCallback(() => {
    void run(true);
  }, [run]);

  return { data, error, isLoading, isReloading, reload };
}
