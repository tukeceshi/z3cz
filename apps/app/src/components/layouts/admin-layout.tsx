import ArrowLeftRight from "lucide-react/icons/arrow-left-right";
import FileText from "lucide-react/icons/file-text";
import HardDriveUpload from "lucide-react/icons/hard-drive-upload";
import Inbox from "lucide-react/icons/inbox";
import KeyRound from "lucide-react/icons/key-round";
import Rocket from "lucide-react/icons/rocket";
import LayoutDashboard from "lucide-react/icons/layout-dashboard";
import Play from "lucide-react/icons/play";
import Settings from "lucide-react/icons/settings";
import Sparkles from "lucide-react/icons/sparkles";
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
import { PAGE_SCROLL_CLASS } from "@/components/list-scroll";
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
      ],
    },
    {
      label: t("sidebar.groups.workflows"),
      items: [
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
      ],
    },
    {
      label: t("sidebar.groups.users"),
      items: [
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
          id: "support",
          title: t("sidebar.support"),
          url: "/admin/support",
          icon: Inbox,
          badgeCount: unreadCount,
        },
      ],
    },
    {
      label: t("sidebar.groups.systemSettings"),
      items: [
        {
          id: "site-settings",
          title: t("sidebar.siteSettings"),
          url: "/admin/settings",
          icon: Settings,
        },
        {
          id: "login-methods",
          title: t("sidebar.loginMethods"),
          url: "/admin/login-methods",
          icon: KeyRound,
        },
        {
          id: "bootstrap",
          title: t("sidebar.bootstrap"),
          url: "/admin/bootstrap",
          icon: Rocket,
        },
        {
          id: "legal-documents",
          title: t("sidebar.legalDocuments"),
          url: "/admin/legal-documents",
          icon: FileText,
        },
        {
          id: "ai-models",
          title: t("sidebar.aiModels"),
          url: "/admin/ai-models",
          icon: Sparkles,
        },
        {
          id: "model-invocations",
          title: t("sidebar.modelInvocations"),
          url: "/admin/model-invocations",
          icon: Sparkles,
        },
        {
          id: "format-templates",
          title: t("sidebar.apiForwarding"),
          url: "/admin/format-templates",
          icon: ArrowLeftRight,
        },
        {
          id: "persist-workers",
          title: t("sidebar.persistWorkers"),
          url: "/admin/persist-workers",
          icon: HardDriveUpload,
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
              <div className={`h-full w-full ${PAGE_SCROLL_CLASS}`}>{children}</div>
            </Sidebar.SidebarInset>
          </Sidebar.SidebarProvider>
        </div>
      </div>
    </PageProvider>
  );
}
