import type { ColumnDef } from "@tanstack/react-table";
import Archive from "lucide-react/icons/archive";
import Github from "lucide-react/icons/github";
import Inbox from "lucide-react/icons/inbox";
import Mail from "lucide-react/icons/mail";
import PenSquare from "lucide-react/icons/pen-square";
import Sparkles from "lucide-react/icons/sparkles";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { OnboardingFunnel } from "@/components/admin/onboarding-funnel";
import { RoleBadge } from "@/components/admin/role-badge";
import { RowActionsMenu } from "@/components/admin/row-actions-menu";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { useBreadcrumbsSetter } from "@/components/page-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppToast } from "@/hooks/use-app-toast";
import type { TranslateFn } from "@/i18n";
import {
  type AdminOnboardingDraft,
  type AdminThreadSummary,
  type AdminUserMembership,
  draftAdminOnboardingMessage,
  resendAdminUserWelcomeEmail,
  sendAdminOnboardingMessage,
  useAdminSupportThreads,
  useAdminUserBilling,
  useAdminUserDetail,
  useAdminUserExecutionsSummary,
  useAdminUserFunnel,
} from "@/services/admin-service";
import { formatDate } from "@/utils/date";

function createThreadColumns(t: TranslateFn): ColumnDef<AdminThreadSummary>[] {
  return [
    {
      accessorKey: "subject",
      header: t("admin.support.subject"),
      cell: ({ row }) => {
        const thread = row.original;
        const href = `/admin/support?userId=${encodeURIComponent(thread.userId ?? "")}&threadId=${thread.id}`;
        return (
          <div className="flex items-center gap-2 min-w-0">
            {thread.unread && (
              <span
                className="h-2 w-2 rounded-full bg-blue-600 shrink-0"
                aria-label={t("admin.support.unread")}
              />
            )}
            <Link
              to={href}
              className="font-medium hover:underline truncate"
              title={thread.subject || t("admin.support.noSubject")}
            >
              {thread.subject || t("admin.support.noSubject")}
            </Link>
          </div>
        );
      },
    },
    {
      accessorKey: "archivedAt",
      header: t("admin.support.status"),
      cell: ({ row }) =>
        row.original.archivedAt ? (
          <Badge variant="secondary" className="gap-1">
            <Archive className="h-3 w-3" />
            {t("admin.support.archived")}
          </Badge>
        ) : (
          <Badge variant="outline">{t("admin.support.open")}</Badge>
        ),
    },
    {
      accessorKey: "lastMessageAt",
      header: t("admin.support.lastMessage"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.lastMessageAt)}
        </span>
      ),
    },
  ];
}

function createMembershipColumns(
  navigate: ReturnType<typeof useNavigate>,
  t: TranslateFn
): ColumnDef<AdminUserMembership>[] {
  return [
    {
      accessorKey: "organizationName",
      header: t("admin.common.organization"),
      cell: ({ row }) => (
        <Link
          to={`/admin/organizations/${row.original.organizationId}`}
          className="font-medium hover:underline"
        >
          {row.original.organizationName}
        </Link>
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
            onClick={() =>
              navigate(`/admin/organizations/${row.original.organizationId}`)
            }
          >
            {t("admin.userDetail.viewOrganization")}
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
}

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user, memberships, userError, isUserLoading } =
    useAdminUserDetail(userId);
  const { funnel, isFunnelLoading } = useAdminUserFunnel(userId);
  const { executionsSummary, isExecutionsSummaryLoading } =
    useAdminUserExecutionsSummary(userId);
  const { billing, isBillingLoading } = useAdminUserBilling(userId);
  const {
    threads: recentThreads,
    pagination: threadsPagination,
    isThreadsLoading: isRecentThreadsLoading,
  } = useAdminSupportThreads(1, 5, "all", undefined, userId);
  const setBreadcrumbs = useBreadcrumbsSetter();
  const { t } = useTranslation();
  const appToast = useAppToast();
  const [resendOpen, setResendOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftOpen, setDraftOpen] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState<AdminOnboardingDraft | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [includeTemplateLink, setIncludeTemplateLink] = useState(true);
  // Bumped on every openDraft so an in-flight AI call from a previous
  // invocation (slow Workers AI, dialog cancelled and reopened, StrictMode
  // double-mount) does not clobber the latest dialog's state.
  const draftRequestIdRef = useRef(0);
  const autoOpenAttemptedRef = useRef(false);

  const membershipColumns = useMemo(
    () => createMembershipColumns(navigate, t),
    [navigate, t]
  );
  const threadColumns = useMemo(() => createThreadColumns(t), [t]);
  const supportFilterHref = userId
    ? `/admin/support?userId=${encodeURIComponent(userId)}`
    : "/admin/support";

  const onConfirmResend = async () => {
    if (!userId) return;
    setIsResending(true);
    try {
      await resendAdminUserWelcomeEmail(userId);
      appToast.success("admin.userDetail.welcomeSent");
      setResendOpen(false);
    } catch (e) {
      appToast.errorRaw(
        e instanceof Error ? e.message : t("admin.userDetail.welcomeSendFailed")
      );
    } finally {
      setIsResending(false);
    }
  };

  const openDraft = async () => {
    if (!userId || isDrafting) return;
    const requestId = ++draftRequestIdRef.current;
    setDraftOpen(true);
    setIsDrafting(true);
    setDraft(null);
    setDraftSubject("");
    setDraftBody("");
    setIncludeTemplateLink(true);
    try {
      const result = await draftAdminOnboardingMessage(userId);
      // Ignore the response if a newer openDraft has fired since.
      if (requestId !== draftRequestIdRef.current) return;
      setDraft(result);
      setDraftSubject(result.draft.subject);
      setDraftBody(result.draft.body);
    } catch (e) {
      if (requestId !== draftRequestIdRef.current) return;
      appToast.errorRaw(
        e instanceof Error ? e.message : t("admin.userDetail.draftFailed")
      );
      setDraftOpen(false);
    } finally {
      if (requestId === draftRequestIdRef.current) {
        setIsDrafting(false);
      }
    }
  };

  const onSendDraft = async () => {
    if (!userId || !draft) return;
    setIsSending(true);
    try {
      await sendAdminOnboardingMessage(userId, {
        subject: draftSubject.trim(),
        body: draftBody.trim(),
        suggestedTemplateId: draft.suggestedTemplate?.id,
        includeTemplateLink:
          Boolean(draft.suggestedTemplate) && includeTemplateLink,
      });
      appToast.success("admin.userDetail.messageSent");
      setDraftOpen(false);
    } catch (e) {
      appToast.errorRaw(
        e instanceof Error ? e.message : t("admin.userDetail.messageSendFailed")
      );
    } finally {
      setIsSending(false);
    }
  };

  // Auto-open the draft dialog when arriving with ?compose=draft (deep
  // link from the stuck-users page). The ref-flag is the single source of
  // truth for "already fired in this mount" — necessary because in
  // StrictMode the effect runs twice on mount before the setSearchParams
  // commit propagates, and the stale closure-captured state guards
  // (isDrafting, draftOpen) would both still read `false`.
  useEffect(() => {
    if (autoOpenAttemptedRef.current) return;
    if (searchParams.get("compose") !== "draft") return;
    if (!userId) return;
    autoOpenAttemptedRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete("compose");
    setSearchParams(next, { replace: true });
    openDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userId]);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.users"), to: "/admin/users" },
      { label: user?.name || t("admin.userDetail.title") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t, user?.name]);

  if (isUserLoading) {
    return <InsetLoading title={t("admin.userDetail.title")} />;
  }

  if (userError) {
    return (
      <InsetError
        title={t("admin.userDetail.title")}
        errorMessage={userError.message}
      />
    );
  }

  if (!user) {
    return (
      <InsetError
        title={t("admin.userDetail.title")}
        errorMessage={t("admin.userDetail.notFound")}
      />
    );
  }

  const hasEmail = Boolean(user.email);
  const composeHref = user.email
    ? `/admin/support?compose=1&to=${encodeURIComponent(user.email)}`
    : "/admin/support";

  return (
    <InsetLayout title={t("admin.userDetail.title")}>
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant="outline"
          onClick={openDraft}
          disabled={!hasEmail || isDrafting}
          title={hasEmail ? undefined : t("admin.userDetail.noEmailHint")}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {t("admin.userDetail.draftMessage")}
        </Button>
        <Button
          variant="outline"
          onClick={() => setResendOpen(true)}
          disabled={!hasEmail}
          title={hasEmail ? undefined : t("admin.userDetail.noEmailHint")}
        >
          <Mail className="h-4 w-4 mr-2" />
          {t("admin.userDetail.resendWelcome")}
        </Button>
        <Button
          variant="outline"
          asChild={hasEmail}
          disabled={!hasEmail}
          title={hasEmail ? undefined : t("admin.userDetail.noEmailHint")}
        >
          {hasEmail ? (
            <Link to={composeHref}>
              <PenSquare className="h-4 w-4 mr-2" />
              {t("admin.userDetail.startThread")}
            </Link>
          ) : (
            <span>
              <PenSquare className="h-4 w-4 mr-2" />
              {t("admin.userDetail.startThread")}
            </span>
          )}
        </Button>
        <Button variant="outline" asChild>
          <Link to={supportFilterHref}>
            <Inbox className="h-4 w-4 mr-2" />
            {t("admin.userDetail.viewThreads")}
          </Link>
        </Button>
      </div>

      <Dialog open={draftOpen} onOpenChange={setDraftOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("admin.userDetail.draftTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.userDetail.draftDescription")}
            </DialogDescription>
          </DialogHeader>

          {isDrafting && (
            <p className="text-sm text-muted-foreground">
              {t("admin.userDetail.drafting")}
            </p>
          )}

          {!isDrafting && draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="draft-subject">{t("admin.userDetail.subject")}</Label>
                <Input
                  id="draft-subject"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="draft-body">{t("admin.userDetail.message")}</Label>
                <Textarea
                  id="draft-body"
                  rows={12}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                />
              </div>

              {draft.suggestedTemplate && (
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">
                        {t("admin.userDetail.suggestedTemplate", {
                          name: draft.suggestedTemplate.name,
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {draft.suggestedTemplate.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        id="include-template"
                        checked={includeTemplateLink}
                        onCheckedChange={setIncludeTemplateLink}
                      />
                      <Label
                        htmlFor="include-template"
                        className="text-xs cursor-pointer"
                      >
                        {t("admin.userDetail.includeLink")}
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">
                  {t("admin.userDetail.modelContext")}
                </div>
                <div>
                  {t("admin.userDetail.stuckAt", {
                    status: draft.context.isDormant
                      ? t("admin.userDetail.dormant")
                      : t("admin.userDetail.stuck"),
                    stage: draft.context.furthestStage,
                    days: draft.context.daysSinceAdvance,
                  })}
                </div>
                {draft.context.orgWorkflowNames.length > 0 && (
                  <div>
                    {t("admin.userDetail.orgWorkflows", {
                      names: draft.context.orgWorkflowNames.slice(0, 5).join(", "),
                    })}
                  </div>
                )}
                {draft.context.pastSupportMessages.length > 0 && (
                  <div>
                    {t("admin.userDetail.pastSupport", {
                      count: draft.context.pastSupportMessages.length,
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDraftOpen(false)}
              disabled={isSending}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={onSendDraft}
              disabled={
                isSending ||
                isDrafting ||
                !draftSubject.trim() ||
                !draftBody.trim()
              }
            >
              {isSending ? t("common.sending") : t("common.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resendOpen} onOpenChange={setResendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.userDetail.resendTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.userDetail.resendDescription", { email: user.email ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmResend} disabled={isResending}>
              {isResending ? t("common.sending") : t("common.send")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.avatarUrl || undefined} />
                <AvatarFallback>
                  {user.name?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div>{user.name}</div>
                <div className="text-sm font-normal text-muted-foreground">
                  {user.email || t("common.noEmail")}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Badge variant={user.plan === "pro" ? "default" : "secondary"}>
                {user.plan}
              </Badge>
              <Badge
                variant={user.role === "admin" ? "destructive" : "outline"}
              >
                {user.role}
              </Badge>
              {user.developerMode && (
                <Badge variant="outline">{t("admin.userDetail.developer")}</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">
                  {t("admin.userDetail.userId")}
                </div>
                <div className="font-mono text-xs">{user.id}</div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t("admin.common.created")}
                </div>
                <div>{formatDate(user.createdAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  {t("admin.common.updated")}
                </div>
                <div>{formatDate(user.updatedAt)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.userDetail.authProviders")}</CardTitle>
            <CardDescription>
              {t("admin.userDetail.authProvidersDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              <span>{t("admin.userDetail.github")}</span>
              {user.githubId ? (
                <Badge variant="default">{t("admin.userDetail.connected")}</Badge>
              ) : (
                <Badge variant="secondary">
                  {t("admin.userDetail.notConnected")}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>{t("admin.userDetail.google")}</span>
              {user.googleId ? (
                <Badge variant="default">{t("admin.userDetail.connected")}</Badge>
              ) : (
                <Badge variant="secondary">
                  {t("admin.userDetail.notConnected")}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("admin.userDetail.orgMemberships")}</CardTitle>
          <CardDescription>
            {t("admin.userDetail.orgMembershipsDesc", {
              count: memberships.length,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            bare
            columns={membershipColumns}
            data={memberships}
            emptyState={{
              title: t("admin.userDetail.noOrgs"),
              description: t("admin.userDetail.noOrgsDesc"),
            }}
          />
        </CardContent>
      </Card>

      {(() => {
        if (isBillingLoading) {
          return (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{t("admin.userDetail.usage")}</CardTitle>
                <CardDescription>{t("common.loading")}</CardDescription>
              </CardHeader>
            </Card>
          );
        }
        if (!billing) return null;
        const isPro = billing.plan === "pro";
        const usageThisPeriod = billing.usageThisPeriod ?? 0;
        const includedCredits = billing.includedCredits ?? 0;
        const usagePercent = includedCredits
          ? Math.min(100, (usageThisPeriod / includedCredits) * 100)
          : 0;
        const hasOverageLimit = billing.overageLimit != null;
        const currentOverage = Math.max(0, usageThisPeriod - includedCredits);
        const overageLimit = billing.overageLimit ?? 0;
        const isOverageAtLimit =
          hasOverageLimit && currentOverage >= overageLimit;
        return (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {t("admin.userDetail.usage")}
                <Badge variant={isPro ? "default" : "secondary"}>
                  {isPro
                    ? t("admin.userDetail.earlyAdopter")
                    : t("admin.userDetail.trial")}
                </Badge>
              </CardTitle>
              <CardDescription>
                {isPro
                  ? t("admin.userDetail.monthlyCreditsDesc")
                  : t("admin.userDetail.trialCreditsDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {isPro
                      ? t("admin.userDetail.includedUsage")
                      : t("admin.userDetail.availableUsage")}
                  </span>
                  <span>
                    {Math.min(
                      usageThisPeriod,
                      includedCredits
                    ).toLocaleString()}{" "}
                    / {includedCredits.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all rounded-full"
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {usagePercent < 100
                    ? t("admin.userDetail.remaining", {
                        count: (includedCredits - usageThisPeriod).toLocaleString(),
                      })
                    : isPro
                      ? t("admin.userDetail.includedExhausted")
                      : t("admin.userDetail.usageExhausted")}
                </p>
              </div>

              {isPro && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">
                      {t("admin.userDetail.additionalUsage")}
                    </span>
                    <span>
                      {currentOverage.toLocaleString()}
                      {hasOverageLimit && ` / ${overageLimit.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    {currentOverage > 0 && (
                      <div
                        className={`h-full transition-all rounded-full ${isOverageAtLimit ? "bg-red-500" : "bg-orange-500"}`}
                        style={{
                          width: hasOverageLimit
                            ? `${Math.min(100, (currentOverage / overageLimit) * 100)}%`
                            : `${Math.min(100, (currentOverage / includedCredits) * 100)}%`,
                        }}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {currentOverage > 0
                      ? isOverageAtLimit
                        ? t("admin.userDetail.limitReached")
                        : t("admin.userDetail.billedEndOfPeriod")
                      : hasOverageLimit
                        ? t("admin.userDetail.limitCredits", {
                            count: overageLimit.toLocaleString(),
                          })
                        : t("admin.userDetail.noOverageYet")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <div className="mt-6">
        <OnboardingFunnel
          funnel={funnel}
          isFunnelLoading={isFunnelLoading}
          executionsSummary={executionsSummary}
          isExecutionsSummaryLoading={isExecutionsSummaryLoading}
        />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle>{t("admin.userDetail.recentThreads")}</CardTitle>
            <CardDescription>
              {isRecentThreadsLoading
                ? t("common.loading")
                : threadsPagination
                  ? t("admin.userDetail.threadsTotal", {
                      total: threadsPagination.total,
                    })
                  : t("admin.userDetail.threadsIncludingArchived")}
            </CardDescription>
          </div>
          {threadsPagination && threadsPagination.total > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link to={supportFilterHref}>{t("admin.userDetail.viewAll")}</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <DataTable
            bare
            columns={threadColumns}
            data={recentThreads}
            emptyState={{
              title: t("admin.userDetail.noThreads"),
              description: t("admin.userDetail.noThreadsDesc"),
            }}
          />
        </CardContent>
      </Card>
    </InsetLayout>
  );
}
