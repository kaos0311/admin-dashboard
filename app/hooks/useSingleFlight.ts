"use client";

import { useCallback, useRef, useState } from "react";

type SingleFlightRun = <T>(
  fn: () => Promise<T>
) => Promise<T | null>;

type UseSingleFlightResult = {
  run: SingleFlightRun;
  running: boolean;
};

export function useSingleFlight(): UseSingleFlightResult {
  const runningRef = useRef(false);

  const mountedRef = useRef(true);

  const [running, setRunning] = useState(false);

  const run = useCallback<SingleFlightRun>(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      if (runningRef.current) {
        console.warn(
          "[SingleFlight] Duplicate async call blocked."
        );

        return null;
      }

      runningRef.current = true;

      if (mountedRef.current) {
        setRunning(true);
      }

      try {
        return await fn();
      } catch (error) {
        console.error(
          "[SingleFlight] Async operation failed:",
          error
        );

        throw error;
      } finally {
        runningRef.current = false;

        if (mountedRef.current) {
          setRunning(false);
        }
      }
    },
    []
  );

  return {
    run,
    running,
  };
}