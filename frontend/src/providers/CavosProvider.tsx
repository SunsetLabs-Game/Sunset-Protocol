import { ReactNode } from "react";

interface CavosProviderProps {
  children: ReactNode;
}

export function CavosProvider({ children }: CavosProviderProps) {
  return <>{children}</>;
}
