"use client";

import { useEffect, useState } from "react";

const memoryCache = new Map<string, unknown>();

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (memoryCache.has(key)) {
      return memoryCache.get(key) as T;
    }

    return initialValue;
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (memoryCache.has(key)) {
      const timeoutId = window.setTimeout(() => {
        setValue(memoryCache.get(key) as T);
        setHydrated(true);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) {
          const parsed = JSON.parse(raw) as T;
          memoryCache.set(key, parsed);
          setValue(parsed);
        }
      } catch {
        setValue(initialValue);
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [initialValue, key]);

  useEffect(() => {
    memoryCache.set(key, value);
    if (!hydrated) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [hydrated, key, value]);

  return [value, setValue, hydrated] as const;
}
