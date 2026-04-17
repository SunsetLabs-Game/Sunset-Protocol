import { useEffect, useState } from "react";

function getInitialState() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { isVisible: true, isFocused: true };
  }

  return {
    isVisible: document.visibilityState === "visible",
    isFocused: document.hasFocus(),
  };
}

/**
 * Indicates whether the app is in a good state for live polling.
 * Polling is disabled while the tab is hidden or the window is unfocused.
 */
export function useCanPoll() {
  const [{ isVisible, isFocused }, setState] = useState(getInitialState);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return;
    }

    const update = () => {
      setState({
        isVisible: document.visibilityState === "visible",
        isFocused: document.hasFocus(),
      });
    };

    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);

    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);

  return isVisible && isFocused;
}
