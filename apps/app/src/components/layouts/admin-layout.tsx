import Building2 from "lucide-react/icons/building-2";
import Cpu from "lucide-react/icons/cpu";
import Database from "lucide-react/icons/database";
import Inbox from "lucide-react/icons/inbox";
import LayoutDashboard from "lucide-react/icons/layout-dashboard";
import ListTodo from "lucide-react/icons/list-todo";
import Mail from "lucide-react/icons/mail";
import Play from "lucide-react/icons/play";
import Settings from "lucide-react/icons/settings";
import SlidersHorizontal from "lucide-react/icons/sliders-horizontal";
import Shapes from "lucide-react/icons/shapes";
import Server from "lucide-react/icons/server";
import Table from "lucide-react/icons/table";
import UserMinus from "lucide-react/icons/user-minus";
import Users from "lucide-react/icons/users";
import Workflow from "lucide-react/icons/workflow";
import { ReactNode } from "react";
import { Toaster } from "sonner";

import { AppHeader } from "@/components/app-header";
import { useTranslation } from "@/components/locale-provider";
import { PageProvider } from "@/components/page-context";
import { SiteBrandingEffect } from "@/components/site-branding-effect";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import type { NavMainProps } from "@/components/sidebar/nav-main";
import * as Sidebar from "@/components/ui/sidebar";
import { useAdminSupportUnreadCount } from "@/services/admin-service";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { unreadCount } = useAdminSupportUnreadCount();
  const { t } = useTranslation();

  const adminSidebarItems: NavMainProps["groups"] = [
    {
      items: [
        {
          id: "dashboard",
          title: t("sidebar.dashboard"),
          url: "/admin",
          icon: LayoutDashboard,
          end: true,
        },
        {
          id: "support",
          title: t("sidebar.support"),
          url: "/admin/support",
          icon: Inbox,
          badgeCount: unreadCount,
        },
        {
          id: "users",
          title: t("sidebar.users"),
          url: "/admin/users",
          icon: Users,
        },
        {
          id: "onboarding",
          title: t("sidebar.onboarding"),
          url: "/admin/onboarding",
          icon: UserMinus,
        },
        {
          id: "organizations",
          title: t("sidebar.organizations"),
          url: "/admin/organizations",
          icon: Building2,
        },
        {
          id: "workflows",
          title: t("sidebar.workflows"),
          url: "/admin/workflows",
          icon: Workflow,
        },
        {
          id: "executions",
          title: t("sidebar.executions"),
          url: "/admin/executions",
          icon: Play,
        },
        {
          id: "emails",
          title: t("sidebar.emails"),
          url: "/admin/emails",
          icon: Mail,
        },
        {
          id: "queues",
          title: t("sidebar.queues"),
          url: "/admin/queues",
          icon: ListTodo,
        },
        {
          id: "datasets",
          title: t("sidebar.datasets"),
          url: "/admin/datasets",
          icon: Table,
        },
        {
          id: "databases",
          title: t("sidebar.databases"),
          url: "/admin/databases",
          icon: Database,
        },
        {
          id: "workflow-schemes",
          title: t("sidebar.workflowSchemes"),
          url: "/admin/workflow-schemes",
          icon: Shapes,
        },
        {
          id: "platform-relay-accounts",
          title: t("sidebar.relayAccounts"),
          url: "/admin/platform-relay-accounts",
          icon: Server,
        },
        {
          id: "ai-interface-templates",
          title: t("sidebar.aiInterfaceTemplates"),
          url: "/admin/ai-interface-templates",
          icon: Cpu,
        },
        {
          id: "feature-settings",
          title: t("sidebar.featureSettings"),
          url: "/admin/feature-settings",
          icon: SlidersHorizontal,
        },
        {
          id: "site-settings",
          title: t("sidebar.siteSettings"),
          url: "/admin/settings",
          icon: Settings,
        },
      ],
    },
  ];

  return (
    <PageProvider>
      <SiteBrandingEffect />
      <div className="flex h-screen w-screen overflow-hidden flex-col">
        <AppHeader />
        <Toaster />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar.SidebarProvider>
            <AppSidebar title={t("sidebar.admin")} groups={adminSidebarItems} />
            <Sidebar.SidebarInset className="bg-neutral-50 dark:bg-neutral-800">
              <div className="h-full w-full overflow-y-auto">{children}</div>
            </Sidebar.SidebarInset>
          </Sidebar.SidebarProvider>
        </div>
      </div>
    </PageProvider>
  );
}
