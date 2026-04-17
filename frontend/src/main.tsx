import "@/polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WalletProvider } from "@/providers/WalletProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { App } from "@/App";
import "@/styles/fonts.css";
import "@/styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WalletProvider>
      <QueryProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </QueryProvider>
    </WalletProvider>
  </StrictMode>
);
