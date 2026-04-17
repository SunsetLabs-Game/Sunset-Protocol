import { useQuery } from "@tanstack/react-query";
import { useSdkStore } from "@/stores/sdkStore";
import { queryKeys } from "@/lib/queryKeys";
import { queryPresets } from "@/lib/queryOptions";
import { useCanPoll } from "@/hooks/useCanPoll";
import type { PoolKey } from "@sunset/sdk";

export function usePoolState(poolKey: PoolKey | null) {
  const client = useSdkStore((s) => s.client);
  const canPoll = useCanPoll();

  return useQuery({
    queryKey: poolKey ? queryKeys.poolState(poolKey) : ["pool", "none"],
    queryFn: async () => {
      if (!client || !poolKey) throw new Error("Not ready");
      return client.getPoolState(poolKey);
    },
    enabled: !!client && !!poolKey,
    ...queryPresets.realtime,
    refetchInterval: canPoll ? 12_000 : false,
  });
}
