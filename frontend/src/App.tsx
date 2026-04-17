import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";

function lazyRoute<T extends Record<string, unknown>, K extends keyof T & string>(
  loader: () => Promise<T>,
  exportName: K,
) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[exportName] as ComponentType };
  });
}

const AppLayout = lazyRoute(() => import("@/components/layout/AppLayout"), "AppLayout");
const LandingPage = lazyRoute(() => import("@/pages/LandingPage"), "LandingPage");
const Dashboard = lazyRoute(() => import("@/pages/Dashboard"), "Dashboard");
const SwapPage = lazyRoute(() => import("@/pages/SwapPage"), "SwapPage");
const ShieldPage = lazyRoute(() => import("@/pages/ShieldPage"), "ShieldPage");
const PoolBrowser = lazyRoute(() => import("@/pages/PoolBrowser"), "PoolBrowser");
const LiquidityPage = lazyRoute(() => import("@/pages/LiquidityPage"), "LiquidityPage");
const PositionsPage = lazyRoute(() => import("@/pages/PositionsPage"), "PositionsPage");
const SettingsPage = lazyRoute(() => import("@/pages/SettingsPage"), "SettingsPage");

function RouteLoader() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-border/50 bg-surface/45 p-8 shadow-[0_16px_40px_rgba(17,17,17,0.08)] backdrop-blur-md">
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-elevated/80">
            <div className="h-full w-1/3 animate-[progress-indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-text-display/80" />
          </div>
          <p className="text-sm font-medium tracking-wide text-text-caption">Loading interface…</p>
        </div>
      </div>
    </div>
  );
}

const suspense = (element: ReactNode) => (
  <Suspense fallback={<RouteLoader />}>{element}</Suspense>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: suspense(<LandingPage />),
  },
  {
    path: "/app",
    element: suspense(<AppLayout />),
    children: [
      { index: true, element: suspense(<Dashboard />) },
      { path: "swap", element: suspense(<SwapPage />) },
      { path: "shield", element: suspense(<ShieldPage />) },
      { path: "liquidity", element: suspense(<LiquidityPage />) },
      { path: "pool", element: suspense(<PoolBrowser />) },
      { path: "positions", element: suspense(<PositionsPage />) },
      { path: "settings", element: suspense(<SettingsPage />) },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
