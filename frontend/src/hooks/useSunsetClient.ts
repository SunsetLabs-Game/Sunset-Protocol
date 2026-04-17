import { useSdkStore } from "@/stores/sdkStore";

/**
 * Returns the initialized client used by the Sunset app shell.
 * Use this in components that require SDK access.
 */
export function useSunsetClient() {
  const client = useSdkStore((s) => s.client);
  const isInitialized = useSdkStore((s) => s.isInitialized);
  return { client, isInitialized };
}
