"use client";

import { useEffect, useRef, useState } from "react";
import type { GenerationResponse } from "@sundera/shared";
import { useAuth } from "@/lib/auth/auth-context";
import { getGeneration } from "./generations";

const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED"]);

export function usePollGeneration(id: string) {
  const { loading: authLoading } = useAuth();
  const [generation, setGeneration] = useState<GenerationResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Wait for Firebase to finish restoring the session before the first
    // request — otherwise a hard refresh sends it unauthenticated (Firebase's
    // currentUser hydrates asynchronously) and the API 403s a generation the
    // user actually owns.
    if (authLoading) return;

    let cancelled = false;

    async function poll() {
      try {
        const result = await getGeneration(id);
        if (cancelled) return;
        setGeneration(result);
        if (TERMINAL_STATUSES.has(result.status) && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load generation");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }

    void poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [id, authLoading]);

  return {
    generation,
    error,
    isPolling: generation ? !TERMINAL_STATUSES.has(generation.status) : true,
  };
}
