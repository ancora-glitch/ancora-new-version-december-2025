import { useCallback, useEffect, useRef, useState } from "react";

export const TRY_ON_STATUS_MESSAGES = [
  "Preparing your photos...",
  "Sending images to try-on...",
  "Detecting body pose...",
  "Building your body model...",
  "Matching the garment...",
  "Generating your try-on...",
  "Almost done — your look is on the way",
];

const PREPARING_PROGRESS = 8;
const ENCODED_PROGRESS = 14;
const MAX_WAIT_PROGRESS = 94;
const TICK_MS = 150;
const ASYMPTOTIC_MS = 55_000;

function waitProgress(elapsedMs: number): number {
  const t = 1 - Math.exp(-elapsedMs / ASYMPTOTIC_MS);
  return ENCODED_PROGRESS + t * (MAX_WAIT_PROGRESS - ENCODED_PROGRESS);
}

function statusIndexForProgress(progress: number): number {
  const range = MAX_WAIT_PROGRESS - ENCODED_PROGRESS;
  const t = range > 0 ? (progress - ENCODED_PROGRESS) / range : 0;
  const idx = Math.floor(t * (TRY_ON_STATUS_MESSAGES.length - 2)) + 2;
  return Math.min(TRY_ON_STATUS_MESSAGES.length - 1, Math.max(2, idx));
}

export function useTryOnProgress() {
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState(TRY_ON_STATUS_MESSAGES[0]);
  const timerRef = useRef<number | null>(null);
  const apiStartRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopTimer();
    apiStartRef.current = null;
    setProgress(0);
    setStatusMessage(TRY_ON_STATUS_MESSAGES[0]);
  }, [stopTimer]);

  const start = useCallback(() => {
    stopTimer();
    apiStartRef.current = null;
    setProgress(PREPARING_PROGRESS);
    setStatusMessage(TRY_ON_STATUS_MESSAGES[0]);
  }, [stopTimer]);

  const markImagesReady = useCallback(() => {
    setProgress(ENCODED_PROGRESS);
    setStatusMessage(TRY_ON_STATUS_MESSAGES[1]);
  }, []);

  const startApiWait = useCallback(() => {
    stopTimer();
    apiStartRef.current = Date.now();
    setStatusMessage(TRY_ON_STATUS_MESSAGES[2]);

    timerRef.current = window.setInterval(() => {
      if (apiStartRef.current === null) return;
      const elapsed = Date.now() - apiStartRef.current;
      const next = Math.round(waitProgress(elapsed));
      setProgress(next);
      setStatusMessage(TRY_ON_STATUS_MESSAGES[statusIndexForProgress(next)]);
    }, TICK_MS);
  }, [stopTimer]);

  const complete = useCallback(async () => {
    stopTimer();
    setProgress(100);
    setStatusMessage("Your look is ready");
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }, [stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  return {
    progress,
    statusMessage,
    start,
    markImagesReady,
    startApiWait,
    complete,
    reset,
  };
}

export function activeStepForProgress(progress: number): number {
  return Math.min(4, Math.floor(progress / 20));
}
