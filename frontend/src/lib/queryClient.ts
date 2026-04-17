import { QueryClient } from "@tanstack/react-query";
import { queryPresets } from "@/lib/queryOptions";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...queryPresets.session,
      refetchOnWindowFocus: false,
    },
  },
});
