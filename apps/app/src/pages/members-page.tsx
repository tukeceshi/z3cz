import type { Invitation, SubAccountPermissions } from "@dafthunk/types";
import { DEFAULT_SUB_ACCOUNT_PERMISSIONS } from "@dafthunk/types";
import type { ColumnDef } from "@tanstack/react-table";
import Clock from "lucide-react/icons/clock";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import X from "lucide-react/icons/x";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { useTranslation } from "@/components/locale-provider";
import {
  createDefaultInvitePermissions,
  SubAccountPermissionsForm,
} from "@/components/sub-account-permissions-form";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppToast } from "@/hooks/use-app-toast";
import { useOwnerPageGuard } from "@/hooks/use-owner-page-guard";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import type { TranslateFn } from "@/i18n";
import {
  createSubAccountInvitation,
  deleteInvitation,
  removeMembership,
  updateMembershipPermissions,
  useInvitations,
  useMemberships,
} from "@/services/organizations-service";
import { formatDate } from "@/utils/date";

type MembershipRow = {
  userId: string;
  organizationId: string;
  role: "member" | "owner";
  permissions: SubAccountPermissions | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
  };
};

const getRoleLabel = (role: string, t: TranslateFn) => {
  if (role === "owner") return t("pages.members.roles.owner");
  return t("pages.members.roles.member");
};

const summarizePermissions = (
  permissions: SubAccountPermissions | null | undefined,
  t: TranslateFn
): string => {
  const effective = permissions ?? DEFAULT_SUB_ACCOUNT_PERMISSIONS;
  const parts: string[] = [];
  parts.push(
    effective.workflows === "edit"
      ? t("pages.members.permissions.edit")
      : t("pages.members.permissions.viewOnly")
  );
  if (effective.executions) parts.push(t("pages.members.permissions.executions"));
  if (effective.modelCalls) parts.push(t("pages.members.permissions.modelCalls"));
  if (effective.aiInterfaces) parts.push(t("pages.members.permissions.aiInterfaces"));
  if (effective.apiKeys) parts.push(t("pages.members.permissions.apiKeys"));
  return parts.join(" · ");
};

const createInvitationColumns = (t: TranslateFn): ColumnDef<Invitation>[] => [
  {
    accessorKey: "email",
    header: t("pages.members.email"),
    cell: ({ row }) => (
      <div className="font-medium">{row.original.email}</div>
    ),
  },
  {
    id: "permissions",
    header: t("pages.members.role"),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {summarizePermissions(row.original.permissions, t)}
      </span>
    ),
  },
  {
    accessorKey: "expiresAt",
    header: t("pages.members.expires"),
    cell: ({ row }) => {
      const date = new Date(row.getValue("expiresAt"));
      const isExpired = date < new Date();
      return (
        <div className={isExpired ? "text-red-500" : ""}>
          {formatDate(date)}
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="text-right">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            document.dispatchEvent(
              new CustomEvent("cancelInvitationTrigger", {
                detail: {
                  invitationId: row.original.id,
                  email: row.original.email,
                },
              })
            )
          }
          title={t("pages.members.cancelInvitation")}
        >
          <X className="h-4 w-4 text-muted-foreground hover:text-red-500" />
        </Button>
      </div>
    ),
  },
];

const createMemberColumns = (t: TranslateFn): ColumnDef<MembershipRow>[] => [
  {
    accessorKey: "user",
    header: t("pages.members.member"),
    cell: ({ row }) => {
      const user = row.getValue("user") as MembershipRow["user"];
      return (
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback>
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{user.name}</div>
            {user.email && (
              <div className="text-sm text-muted-foreground">{user.email}</div>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "role",
    header: t("pages.members.role"),
    cell: ({ row }) => {
      const role = row.getValue("role") as string;
      return (
        <Badge variant={role === "owner" ? "default" : "outline"}>
          {getRoleLabel(role, t)}
        </Badge>
      );
    },
  },
  {
    id: "permissions",
    header: t("pages.members.editPermissions"),
    cell: ({ row }) => {
      const membership = row.original;
      if (membership.role === "owner") {
        return <span className="text-sm text-muted-foreground">—</span>;
      }
      return (
        <span className="text-sm text-muted-foreground">
          {summarizePermissions(
            membership.permissions ?? DEFAULT_SUB_ACCOUNT_PERMISSIONS,
            t
          )}
        </span>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: t("pages.members.joined"),
    cell: ({ row }) => formatDate(row.getValue("createdAt") as Date),
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const membership = row.original;
      if (membership.role === "owner") {
        return null;
      }

      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-haspopup="true" size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  document.dispatchEvent(
                    new CustomEvent("editPermissionsTrigger", {
                      detail: {
                        userEmail: membership.user.email || "",
                        userName: membership.user.name,
                        permissions:
                          membership.permissions ?? DEFAULT_SUB_ACCOUNT_PERMISSIONS,
                      },
                    })
                  )
                }
              >
                {t("pages.members.editPermissions")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  document.dispatchEvent(
                    new CustomEvent("removeMemberTrigger", {
                      detail: {
                        userName: membership.user.name,
                        userEmail: membership.user.email || "",
                      },
                    })
                  )
                }
                className="text-red-600 focus:text-red-600"
              >
                {t("pages.members.removeMember")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

export function MembersPage() {
  const ownerGuard = useOwnerPageGuard("sidebar.members");
  if (ownerGuard.blocked) return ownerGuard.gate;
  return <MembersPageContent />;
}

function MembersPageContent() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { organizationId } = useParams<{ organizationId: string }>();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);

  const {
    memberships,
    membershipsError,
    isMembershipsLoading,
    mutateMemberships,
  } = useMemberships(organizationId || "");

  const { invitations, mutateInvitations } = useInvitations(
    organizationId || ""
  );

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isEditPermissionsOpen, setIsEditPermissionsOpen] = useState(false);
  const [isRemoveMemberDialogOpen, setIsRemoveMemberDialogOpen] =
    useState(false);
  const [isCancelInvitationDialogOpen, setIsCancelInvitationDialogOpen] =
    useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [invitePermissions, setInvitePermissions] = useState(
    createDefaultInvitePermissions()
  );

  const [memberToEdit, setMemberToEdit] = useState<{
    userName: string;
    userEmail: string;
    permissions: SubAccountPermissions;
  } | null>(null);

  const [memberToRemove, setMemberToRemove] = useState<{
    userName: string;
    userEmail: string;
  } | null>(null);

  const [invitationToCancel, setInvitationToCancel] = useState<{
    invitationId: string;
    email: string;
  } | null>(null);

  const memberColumns = useMemo(() => createMemberColumns(t), [t]);
  const invitationColumns = useMemo(() => createInvitationColumns(t), [t]);

  const handleInvite = useCallback(async (): Promise<void> => {
    if (!newMemberEmail.trim()) {
      appToast.error("pages.members.emailRequired");
      return;
    }

    setIsProcessing(true);
    try {
      await createSubAccountInvitation(organizationId || "", {
        email: newMemberEmail.trim(),
        permissions: invitePermissions,
      });

      appToast.success("pages.members.inviteSent");
      setIsInviteDialogOpen(false);
      setNewMemberEmail("");
      setInvitePermissions(createDefaultInvitePermissions());
      await mutateInvitations();
    } catch (error) {
      appToast.error("pages.members.inviteFailed");
      console.error("Send invitation error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [
    appToast,
    invitePermissions,
    mutateInvitations,
    newMemberEmail,
    organizationId,
  ]);

  const handleSavePermissions = useCallback(async (): Promise<void> => {
    if (!memberToEdit) return;

    setIsProcessing(true);
    try {
      await updateMembershipPermissions(organizationId || "", {
        email: memberToEdit.userEmail,
        permissions: memberToEdit.permissions,
      });

      appToast.success("pages.members.permissionsUpdated");
      setIsEditPermissionsOpen(false);
      setMemberToEdit(null);
      await mutateMemberships();
    } catch (error) {
      appToast.error("pages.members.permissionsUpdateFailed");
      console.error("Update permissions error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [appToast, memberToEdit, mutateMemberships, organizationId]);

  const handleRemoveMember = useCallback(async (): Promise<void> => {
    if (!memberToRemove) return;

    setIsProcessing(true);
    try {
      await removeMembership(organizationId || "", {
        email: memberToRemove.userEmail,
      });

      appToast.success("pages.members.memberRemoved");
      setIsRemoveMemberDialogOpen(false);
      setMemberToRemove(null);
      await mutateMemberships();
    } catch (error) {
      appToast.error("pages.members.memberRemoveFailed");
      console.error("Remove member error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [appToast, memberToRemove, mutateMemberships, organizationId]);

  const handleCancelInvitation = useCallback(async (): Promise<void> => {
    if (!invitationToCancel) return;

    setIsProcessing(true);
    try {
      await deleteInvitation(
        organizationId || "",
        invitationToCancel.invitationId
      );

      appToast.success("pages.members.inviteCancelled");
      setIsCancelInvitationDialogOpen(false);
      setInvitationToCancel(null);
      await mutateInvitations();
    } catch (error) {
      appToast.error("pages.members.inviteCancelFailed");
      console.error("Cancel invitation error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [appToast, invitationToCancel, mutateInvitations, organizationId]);

  useEffect(() => {
    const onEdit = (e: Event) => {
      const custom = e as CustomEvent<{
        userName: string;
        userEmail: string;
        permissions: SubAccountPermissions;
      }>;
      if (custom.detail) {
        setMemberToEdit(custom.detail);
        setIsEditPermissionsOpen(true);
      }
    };

    const onRemove = (e: Event) => {
      const custom = e as CustomEvent<{
        userName: string;
        userEmail: string;
      }>;
      if (custom.detail) {
        setMemberToRemove(custom.detail);
        setIsRemoveMemberDialogOpen(true);
      }
    };

    const onCancelInvite = (e: Event) => {
      const custom = e as CustomEvent<{
        invitationId: string;
        email: string;
      }>;
      if (custom.detail) {
        setInvitationToCancel(custom.detail);
        setIsCancelInvitationDialogOpen(true);
      }
    };

    document.addEventListener("editPermissionsTrigger", onEdit);
    document.addEventListener("removeMemberTrigger", onRemove);
    document.addEventListener("cancelInvitationTrigger", onCancelInvite);

    return () => {
      document.removeEventListener("editPermissionsTrigger", onEdit);
      document.removeEventListener("removeMemberTrigger", onRemove);
      document.removeEventListener("cancelInvitationTrigger", onCancelInvite);
    };
  }, []);

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.members") }]);
  }, [setBreadcrumbs, t]);

  if (isMembershipsLoading && !memberships) {
    return <InsetLoading title={t("pages.members.loadingTitle")} />;
  }

  if (membershipsError) {
    return (
      <InsetError
        title={t("pages.members.loadingTitle")}
        errorMessage={membershipsError.message}
      />
    );
  }

  return (
    <InsetLayout title={t("pages.members.title")}>
      <div className="flex items-center justify-between mb-6 min-h-10">
        <div className="text-sm text-muted-foreground max-w-2xl">
          {t("pages.members.description")}
        </div>
        <Button onClick={() => setIsInviteDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("pages.members.inviteButton")}
        </Button>
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList>
          <TabsTrigger value="members">
            {t("pages.members.tabs.members", {
              count: memberships?.length || 0,
            })}
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Clock className="mr-2 h-4 w-4" />
            {t("pages.members.tabs.invitations", {
              count: invitations?.length || 0,
            })}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4">
          <DataTable
            columns={memberColumns}
            data={memberships || []}
            emptyState={{
              title: t("pages.members.emptyMembersTitle"),
              description: t("pages.members.emptyMembersDescription"),
            }}
          />
        </TabsContent>
        <TabsContent value="invitations" className="mt-4">
          <DataTable
            columns={invitationColumns}
            data={invitations || []}
            emptyState={{
              title: t("pages.members.emptyInvitationsTitle"),
              description: t("pages.members.emptyInvitationsDescription"),
            }}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.members.inviteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.members.inviteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-email">{t("pages.members.emailAddress")}</Label>
              <Input
                id="user-email"
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <SubAccountPermissionsForm
              value={invitePermissions}
              onChange={setInvitePermissions}
              disabled={isProcessing}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleInvite()}
              disabled={isProcessing || !newMemberEmail.trim()}
            >
              {isProcessing ? t("common.loading") : t("pages.members.sendInvitation")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isEditPermissionsOpen}
        onOpenChange={setIsEditPermissionsOpen}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.members.editPermissionsTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.members.editPermissionsDescription", {
                name: memberToEdit?.userName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {memberToEdit && (
            <SubAccountPermissionsForm
              value={memberToEdit.permissions}
              onChange={(permissions) =>
                setMemberToEdit({ ...memberToEdit, permissions })
              }
              disabled={isProcessing}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToEdit(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleSavePermissions()}
              disabled={isProcessing}
            >
              {isProcessing
                ? t("common.loading")
                : t("pages.members.savePermissions")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isRemoveMemberDialogOpen}
        onOpenChange={setIsRemoveMemberDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.members.removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.members.removeDescription", {
                name: memberToRemove?.userName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{t("pages.members.removeWarning")}</AlertDescription>
          </Alert>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToRemove(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRemoveMember()}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing
                ? t("common.loading")
                : t("pages.members.removeMember")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isCancelInvitationDialogOpen}
        onOpenChange={setIsCancelInvitationDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.members.cancelInviteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.members.cancelInviteDescription", {
                email: invitationToCancel?.email ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInvitationToCancel(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleCancelInvitation()}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing
                ? t("common.loading")
                : t("pages.members.cancelInvitationAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InsetLayout>
  );
}
