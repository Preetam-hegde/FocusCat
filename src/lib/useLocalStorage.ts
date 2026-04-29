"use client";

import { useEffect, useRef, useState } from "react";

const memoryCache = new Map<string, unknown>();

type UseLocalStorageOptions = {
  writeDelayMs?: number;
};

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions = {}
) {
  const [value, setValue] = useState<T>(() => {
    if (memoryCache.has(key)) {
      return memoryCache.get(key) as T;
    }

    return initialValue;
  });
  const [hydrated, setHydrated] = useState(false);
  const writeTimeoutRef = useRef<number | null>(null);

  const writeDelayMs = options.writeDelayMs ?? 250;

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

    if (writeTimeoutRef.current !== null) {
      window.clearTimeout(writeTimeoutRef.current);
    }

    writeTimeoutRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } finally {
        writeTimeoutRef.current = null;
      }
    }, writeDelayMs);

    return () => {
      if (writeTimeoutRef.current !== null) {
        window.clearTimeout(writeTimeoutRef.current);
        writeTimeoutRef.current = null;
      }
    };
  }, [hydrated, key, value, writeDelayMs]);

  return [value, setValue, hydrated] as const;
}
