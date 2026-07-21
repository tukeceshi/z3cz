import { ReactNode } from "react";
import { Toaster } from "sonner";

import { AppHeader } from "@/components/app-header";
import { PageProvider } from "@/components/page-context";
import { SiteBrandingEffect } from "@/components/site-branding-effect";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { NavMainProps } from "@/components/sidebar/nav-main";
import * as Sidebar from "@/components/ui/sidebar";
import { cn } from "@/utils/utils";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
  sidebar?: {
    title: string;
    groups: NavMainProps["groups"];
    footerItems?: NavMainProps["footerItems"];
  };
  /** Initial sidebar open state for routes that need a fixed layout before paint. */
  sidebarDefaultOpen?: boolean;
}

export function AppLayout({
  children,
  sidebar,
  className,
  sidebarDefaultOpen = true,
}: AppLayoutProps) {
  return (
    <PageProvider>
      <SiteBrandingEffect />
      <div className="flex h-screen w-screen overflow-hidden flex-col">
        <AppHeader />
        <Toaster />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {sidebar ? (
            <Sidebar.SidebarProvider
              defaultOpen={sidebarDefaultOpen}
              className="flex h-full min-h-0 w-full flex-1"
            >
              <AppSidebar
                title={sidebar.title}
                groups={sidebar.groups}
                footerItems={sidebar.footerItems}
              />
              <Sidebar.SidebarInset className="flex min-h-0 flex-1 flex-col bg-neutral-50 dark:bg-neutral-800">
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {children}
                </div>
              </Sidebar.SidebarInset>
            </Sidebar.SidebarProvider>
          ) : (
            <div
              className={cn(
                "relative flex w-full flex-1 flex-col bg-background overflow-auto",
                className
              )}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </PageProvider>
  );
}
