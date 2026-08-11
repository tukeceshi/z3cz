import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { RoleBadge } from "@/components/admin/role-badge";
import { RowActionsMenu } from "@/components/admin/row-actions-menu";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  type AdminOrganizationMember,
  useAdminOrganizationDetail,
  useAdminOrganizationEntityCounts,
} from "@/services/admin-service";
import type { TranslateFn } from "@/i18n";
import { formatDate } from "@/utils/date";

function createMemberColumns(
  navigate: ReturnType<typeof useNavigate>,
  t: TranslateFn
): ColumnDef<AdminOrganizationMember>[] {
  return [
    {
      accessorKey: "userName",
      header: t("admin.table.user"),
      cell: ({ row }) => (
        <Link
          to={`/admin/users/${row.original.userId}`}
          className="flex items-center gap-2 font-medium hover:underline"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.original.userAvatarUrl || undefined} />
            <AvatarFallback>
              {row.original.userName?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <span>{row.original.userName}</span>
        </Link>
      ),
    },
    {
      accessorKey: "userEmail",
      header: t("admin.table.email"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.userEmail || "-"}
        </span>
      ),
    },
    {
      accessorKey: "role",
      header: t("admin.common.role"),
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      accessorKey: "joinedAt",
      header: t("admin.userDetail.joined"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.joinedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <RowActionsMenu>
          <DropdownMenuItem
            onClick={() => navigate(`/admin/users/${row.original.userId}`)}
          >
            {t("admin.organizationDetail.viewUser")}
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
}

export function AdminOrganizationDetailPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const { organization, members, organizationError, isOrganizationLoading } =
    useAdminOrganizationDetail(organizationId);
  const { entityCounts, isEntityCountsLoading } =
    useAdminOrganizationEntityCounts(organizationId);
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { t } = useTranslation();

  const memberColumns = useMemo(
    () => createMemberColumns(navigate, t),
    [navigate, t]
  );

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.organizations"), to: "/admin/organizations" },
      { label: organization?.name || t("admin.organizationDetail.title") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t, organization?.name]);

  if (isOrganizationLoading || isEntityCountsLoading) {
    return <InsetLoading title={t("admin.organizationDetail.title")} />;
  }

  if (organizationError) {
    return (
      <InsetError
        title={t("admin.organizationDetail.title")}
        errorMessage={organizationError.message}
      />
    );
  }

  if (!organization) {
    return (
      <InsetError
        title={t("admin.organizationDetail.title")}
        errorMessage={t("admin.organizationDetail.notFound")}
      />
    );
  }

  return (
    <InsetLayout title={t("admin.organizationDetail.title")}>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{organization.name}</CardTitle>
            <CardDescription className="font-mono">
              @{organization.id}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {organization.subscriptionStatus ? (
                <Badge
                  variant={
                    organization.subscriptionStatus === "active"
                      ? "default"
                      : "secondary"
                  }
                >
                  {organization.subscriptionStatus}
                </Badge>
              ) : (
                <Badge variant="outline">{t("admin.organizationDetail.trial")}</Badge>
              )}
              {organization.creditsExhausted && (
                <Badge variant="destructive">
                  {t("admin.organizationDetail.creditsExhausted")}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">
                  {t("admin.organizationDetail.orgId")}
                </div>
                <div className="font-mono text-xs">{organization.id}</div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t("admin.common.created")}
                </div>
                <div>{formatDate(organization.createdAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t("admin.organizationDetail.computeCredits")}
                </div>
                <div>{organization.computeCredits.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t("admin.organizationDetail.overageLimit")}
                </div>
                <div>
                  {organization.overageLimit
                    ? organization.overageLimit.toLocaleString()
                    : t("admin.organizationDetail.unlimited")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.organizationDetail.billingInfo")}</CardTitle>
            <CardDescription>
              {t("admin.organizationDetail.billingInfoDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">
                  {t("admin.organizationDetail.stripeCustomerId")}
                </div>
                <div className="font-mono text-xs">
                  {organization.stripeCustomerId || "-"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t("admin.organizationDetail.subscriptionId")}
                </div>
                <div className="font-mono text-xs">
                  {organization.stripeSubscriptionId || "-"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t("admin.organizationDetail.periodStart")}
                </div>
                <div>
                  {organization.currentPeriodStart
                    ? formatDate(organization.currentPeriodStart)
                    : "-"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t("admin.organizationDetail.periodEnd")}
                </div>
                <div>
                  {organization.currentPeriodEnd
                    ? formatDate(organization.currentPeriodEnd)
                    : "-"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("admin.organizationDetail.members")}</CardTitle>
          <CardDescription>
            {t("admin.organizationDetail.membersDesc", {
              count: members.length,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            bare
            columns={memberColumns}
            data={members}
            emptyState={{
              title: t("admin.organizationDetail.noMembers"),
              description: t("admin.organizationDetail.noMembersDesc"),
            }}
          />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <Link
          to={`/admin/workflows?organizationId=${organizationId}`}
          className="block"
        >
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription>{t("sidebar.workflows")}</CardDescription>
              <CardTitle className="text-2xl">
                {entityCounts?.workflowCount ?? "-"}
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link
          to={`/admin/executions?organizationId=${organizationId}`}
          className="block"
        >
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription>{t("sidebar.executions")}</CardDescription>
              <CardTitle className="text-2xl">
                {entityCounts?.executionCount ?? "-"}
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link
          to={`/admin/emails?organizationId=${organizationId}`}
          className="block"
        >
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription>{t("sidebar.emails")}</CardDescription>
              <CardTitle className="text-2xl">
                {entityCounts?.emailCount ?? "-"}
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link
          to={`/admin/queues?organizationId=${organizationId}`}
          className="block"
        >
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription>{t("sidebar.queues")}</CardDescription>
              <CardTitle className="text-2xl">
                {entityCounts?.queueCount ?? "-"}
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Link
          to={`/admin/databases?organizationId=${organizationId}`}
          className="block"
        >
          <Card className="hover:bg-muted/50 transition-colors">
            <CardHeader className="pb-2">
              <CardDescription>{t("sidebar.databases")}</CardDescription>
              <CardTitle className="text-2xl">
                {entityCounts?.databaseCount ?? "-"}
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </InsetLayout>
  );
}
