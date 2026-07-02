"use client";

import * as React from "react";
import { MotionConfig } from "framer-motion";
import type { Role } from "@prisma/client";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { AiAssistant } from "@/components/ai/assistant";
import { TooltipProvider } from "@/components/ui/misc";

const RoleContext = React.createContext<Role>("VIEWER");
export const useRole = () => React.useContext(RoleContext);

export function AppShell({
  children,
  userRole,
}: {
  children: React.ReactNode;
  userRole: Role;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <RoleContext.Provider value={userRole}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={200}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <div className="min-h-screen">
            <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
            <div className="lg:pl-64">
              <Topbar onMenuClick={() => setMobileOpen(true)} />
              <main id="main-content" tabIndex={-1} className="p-4 sm:p-6 outline-none animate-fade-in">
                {children}
              </main>
            </div>
            <AiAssistant />
          </div>
        </TooltipProvider>
      </MotionConfig>
    </RoleContext.Provider>
  );
}
