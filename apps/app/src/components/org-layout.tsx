import type { OrganizationInfo } from "@dafthunk/types";
import Cpu from "lucide-react/icons/cpu";
import LayoutDashboard from "lucide-react/icons/layout-dashboard";
import Sparkles from "lucide-react/icons/sparkles";
import SquareTerminal from "lucide-react/icons/square-terminal";
import Users from "lucide-react/icons/users";
import React, { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { InsetLoading } from "@/components/inset-loading";
import { AppLayout } from "@/components/layouts/app-layout";
import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { TourProvider } from "@/components/tour";
import {
  canAccessAiInterfaces,
  canAccessModelCalls,
  canManageSubAccounts,
  canViewWorkflows,
} from "@/utils/sub-account-permissions";

interface OrgLayoutProps {
  children: React.ReactNode;
  title: string;
  sidebarDefaultOpen?: boolean;
}

function buildWorkflowSidebarItems(
  orgId: string,
  t: (key: TranslationKey) => string
) {
  return [
    {
      id: "workflows",
      title: t("sidebar.workflows"),
      url: `/org/${orgId}/workflows`,
      icon: SquareTerminal,
    },
    {
      id: "model-calls",
      title: t("sidebar.modelCalls"),
      url: `/org/${orgId}/model-calls`,
      icon: Sparkles,
    },
  ];
}

export const getDashboardSidebarGroups = (
  orgId: string,
  t: (key: TranslationKey) => string
) => {
  const groups = [
    {
      items: [
        {
          id: "dashboard",
          title: t("sidebar.dashboard"),
          url: `/org/${orgId}/dashboard`,
          icon: LayoutDashboard,
        },
      ],
    },
    {
      tourId: "workflows",
      label: t("sidebar.workflows"),
      items: buildWorkflowSidebarItems(orgId, t),
    },
    {
      tourId: "settings",
      label: t("nav.settings"),
      items: [
        {
          id: "ai-interfaces",
          title: t("sidebar.aiInterfaces"),
          url: `/org/${orgId}/ai-interfaces`,
          icon: Cpu,
        },
        {
          id: "members",
          title: t("sidebar.members"),
          url: `/org/${orgId}/members`,
          icon: Users,
        },
      ],
    },
  ];

  return groups.filter((group) => group.items.length > 0);
};

function filterSidebarGroupsByPermissions(
  groups: ReturnType<typeof getDashboardSidebarGroups>,
  organization: OrganizationInfo | null
) {
  const canAccessItem = (itemId: string): boolean => {
    switch (itemId) {
      case "dashboard":
        return canViewWorkflows(organization) || canAccessModelCalls(organization);
      case "workflows":
        return canViewWorkflows(organization);
      case "model-calls":
        return canAccessModelCalls(organization);
      case "ai-interfaces":
        return canAccessAiInterfaces(organization);
      case "members":
        return canManageSubAccounts(organization);
      default:
        return true;
    }
  };

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessItem(item.id)),
    }))
    .filter((group) => group.items.length > 0);
}

export const OrgLayout: React.FC<OrgLayoutProps> = ({
  children,
  title,
  sidebarDefaultOpen = true,
}) => {
  const params = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const { organization, isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  useEffect(() => {
    if (
      params.organizationId &&
      organization?.id &&
      params.organizationId !== organization.id
    ) {
      navigate(`/org/${organization.id}/dashboard`, { replace: true });
    }
  }, [navigate, organization?.id, params.organizationId]);

  if (isLoading) {
    return <InsetLoading />;
  }

  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(
      `${window.location.pathname}${window.location.search}`
    );
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  if (!organization?.id) {
    return <InsetLoading />;
  }

  const sidebarGroups = filterSidebarGroupsByPermissions(
    getDashboardSidebarGroups(organization.id, t),
    organization
  );

  return (
    <AppLayout
      sidebar={{
        title,
        groups: sidebarGroups,
        footerItems: [],
      }}
      sidebarDefaultOpen={sidebarDefaultOpen}
    >
      <TourProvider>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </TourProvider>
    </AppLayout>
  );
};
