"use client";

import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConnectionToast } from "@/components/ConnectionToast";
import { PushNavigationListener } from "@/components/notifications/PushNavigationListener";
import { Toaster } from "@/components/Toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useLang } from "@/hooks/useLang";
import { getQueryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <QueryClientProvider client={getQueryClient()}>
      <TooltipProvider>
        {children}
        <Toaster />
        <ConnectionToast />
        <PushNavigationListener />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
