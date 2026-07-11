import type { OrganizationInfo, PlatformFeatureConfig, ResourceFeatureId } from "@dafthunk/types";
import Bot from "lucide-react/icons/bot";
import Cpu from "lucide-react/icons/cpu";
import CreditCard from "lucide-react/icons/credit-card";
import Database from "lucide-react/icons/database";
import FlaskConical from "lucide-react/icons/flask-conical";
import Folder from "lucide-react/icons/folder";
import Inbox from "lucide-react/icons/inbox";
import KeyRound from "lucide-react/icons/key-round";
import LayoutDashboard from "lucide-react/icons/layout-dashboard";
import Lock from "lucide-react/icons/lock";
import Logs from "lucide-react/icons/logs";
import Mail from "lucide-react/icons/mail";
import MessageSquareText from "lucide-react/icons/message-square-text";
import Plug from "lucide-react/icons/plug";
import SquareTerminal from "lucide-react/icons/square-terminal";
import TableProperties from "lucide-react/icons/table-properties";

import Users from "lucide-react/icons/users";
import Wand from "lucide-react/icons/wand";
import React, { useEffect } from "react";
import { useParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { AppLayout } from "@/components/layouts/app-layout";
import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { TourProvider } from "@/components/tour";
import { isPlatformFeatureEnabled } from "@/hooks/use-feature-config";
import { useOrganizations } from "@/services/organizations-service";

interface OrgLayoutProps {
  children: React.ReactNode;
  title: string;
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
      id: "executions",
      title: t("sidebar.executions"),
      url: `/org/${orgId}/executions`,
      icon: Logs,
    },
    {
      id: "feedback",
      title: t("sidebar.feedback"),
      url: `/org/${orgId}/feedback`,
      icon: MessageSquareText,
    },
    {
      id: "templates",
      title: t("sidebar.templates"),
      url: `/org/${orgId}/templates`,
      icon: Wand,
    },
    {
      id: "playground",
      title: t("sidebar.playground"),
      url: `/org/${orgId}/playground`,
      icon: FlaskConical,
    },
  ];
}

function buildResourceSidebarItems(
  orgId: string,
  t: (key: TranslationKey) => string,
  featureConfig: PlatformFeatureConfig
) {
  const isEnabled = (id: ResourceFeatureId) =>
    isPlatformFeatureEnabled(featureConfig, id);

  return [
    {
      id: "schemas",
      title: t("sidebar.schemas"),
      url: `/org/${orgId}/schemas`,
      icon: TableProperties,
    },
    {
      id: "databases",
      title: t("sidebar.databases"),
      url: `/org/${orgId}/databases`,
      icon: Database,
    },
    {
      id: "datasets",
      title: t("sidebar.datasets"),
      url: `/org/${orgId}/datasets`,
      icon: Folder,
    },
    {
      id: "integrations",
      title: t("sidebar.integrations"),
      url: `/org/${orgId}/integrations`,
      icon: Plug,
    },
    {
      id: "secrets",
      title: t("sidebar.secrets"),
      url: `/org/${orgId}/secrets`,
      icon: Lock,
    },
    {
      id: "ai-interfaces",
      title: t("sidebar.aiInterfaces"),
      url: `/org/${orgId}/ai-interfaces`,
      icon: Cpu,
    },
    {
      id: "emails",
      title: t("sidebar.emails"),
      url: `/org/${orgId}/emails`,
      icon: Mail,
    },
    {
      id: "queues",
      title: t("sidebar.queues"),
      url: `/org/${orgId}/queues`,
      icon: Inbox,
    },
    {
      id: "bots",
      title: t("sidebar.bots"),
      url: `/org/${orgId}/bots`,
      icon: Bot,
    },
  ].filter((item) => isEnabled(item.id as ResourceFeatureId));
}

export const getDashboardSidebarGroups = (
  orgId: string,
  t: (key: TranslationKey) => string,
  featureConfig: PlatformFeatureConfig
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
      label: t("sidebar.workflows"),
      items: buildWorkflowSidebarItems(orgId, t),
    },
    {
      label: t("sidebar.resources"),
      items: buildResourceSidebarItems(orgId, t, featureConfig),
    },
  ];

  groups.push({
    label: t("nav.settings"),
    items: [
      {
        id: "api-keys",
        title: t("sidebar.apiKeys"),
        url: `/org/${orgId}/api-keys`,
        icon: KeyRound,
      },
      {
        id: "members",
        title: t("sidebar.members"),
        url: `/org/${orgId}/members`,
        icon: Users,
      },
      {
        id: "billing",
        title: t("sidebar.billing"),
        url: `/org/${orgId}/billing`,
        icon: CreditCard,
      },
    ],
  });

  return groups.filter((group) => group.items.length > 0);
};

export const OrgLayout: React.FC<OrgLayoutProps> = ({ children, title }) => {
  const params = useParams<{ organizationId: string }>();
  const { organization, setSelectedOrganization } = useAuth();
  const { organizations: orgList } = useOrganizations();
  const { t, siteSettings } = useTranslation();

  useEffect(() => {
    if (params.organizationId && organization?.id && orgList.length > 0) {
      if (params.organizationId !== organization.id) {
        const targetOrg = orgList.find(
          (org) => org.id === params.organizationId
        );
        if (targetOrg) {
          const newOrg: OrganizationInfo = {
            id: targetOrg.id,
            name: targetOrg.name,
            role: "owner",
          };
          setSelectedOrganization(newOrg);
        }
      }
    }
  }, [
    params.organizationId,
    organization?.id,
    orgList,
    setSelectedOrganization,
  ]);

  if (!organization?.id) {
    return <div>{t("common.loading")}</div>;
  }

  const sidebarGroups = getDashboardSidebarGroups(
    organization.id,
    t,
    siteSettings.featureConfig
  );

  return (
    <AppLayout
      sidebar={{
        title,
        groups: sidebarGroups,
        footerItems: [],
      }}
    >
      <TourProvider>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </TourProvider>
    </AppLayout>
  );
};
