import { useEffect, useRef, useState } from "react";

export function useHoverOverlayPresence<T>(closeDelayMs = 90) {
  const [hoverState, setHoverState] = useState<T | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const hoverStateRef = useRef<T | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  function clearCloseTimeout() {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }

  function showHoverOverlay(nextHoverState: T) {
    clearCloseTimeout();
    hoverStateRef.current = nextHoverState;
    setIsClosing(false);
    setHoverState(nextHoverState);
  }

  function beginHideHoverOverlay(shouldHide?: (current: T) => boolean) {
    const currentHoverState = hoverStateRef.current;
    if (!currentHoverState) {
      return;
    }

    if (shouldHide && !shouldHide(currentHoverState)) {
      return;
    }

    clearCloseTimeout();
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      const latestHoverState = hoverStateRef.current;
      if (!latestHoverState) {
        setIsClosing(false);
        closeTimeoutRef.current = null;
        return;
      }

      if (!shouldHide || shouldHide(latestHoverState)) {
        hoverStateRef.current = null;
        setHoverState(null);
      }

      setIsClosing(false);
      closeTimeoutRef.current = null;
    }, closeDelayMs);
  }

  function clearHoverOverlay() {
    clearCloseTimeout();
    hoverStateRef.current = null;
    setIsClosing(false);
    setHoverState(null);
  }

  useEffect(() => {
    hoverStateRef.current = hoverState;
  }, [hoverState]);

  useEffect(() => clearHoverOverlay, []);

  return {
    hoverState,
    isClosing,
    showHoverOverlay,
    beginHideHoverOverlay,
    clearHoverOverlay
  };
}
