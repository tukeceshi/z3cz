import type { Invitation } from "@dafthunk/types";
import type { ColumnDef } from "@tanstack/react-table";
import Clock from "lucide-react/icons/clock";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import X from "lucide-react/icons/x";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { useTranslation } from "@/components/locale-provider";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppToast } from "@/hooks/use-app-toast";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import type { TranslateFn } from "@/i18n";
import {
  createInvitation,
  deleteInvitation,
  removeMembership,
  updateMembership,
  useInvitations,
  useMemberships,
} from "@/services/organizations-service";
import { formatDate } from "@/utils/date";

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "owner":
      return "default" as const;
    case "admin":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

const getRoleLabel = (role: string, t: TranslateFn) => {
  if (role === "owner") return t("pages.members.roles.owner");
  if (role === "admin") return t("pages.members.roles.admin");
  return t("pages.members.roles.member");
};

const createInvitationColumns = (t: TranslateFn): ColumnDef<Invitation>[] => [
  {
    accessorKey: "email",
    header: t("pages.members.email"),
    cell: ({ row }) => {
      return (
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {row.original.email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{row.original.email}</div>
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
        <Badge variant={getRoleBadgeVariant(role)}>
          {getRoleLabel(role, t)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "expiresAt",
    header: t("pages.members.expires"),
    cell: ({ row }) => {
      const date = new Date(row.getValue("expiresAt"));
      const now = new Date();
      const isExpired = date < now;
      return (
        <div className={isExpired ? "text-red-500" : ""}>
          {formatDate(date)}
        </div>
      );
    },
  },
  {
    accessorKey: "inviter",
    header: t("pages.members.invitedBy"),
    cell: ({ row }) => {
      const inviter = row.original.inviter;
      return (
        <div className="flex items-center space-x-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={inviter.avatarUrl} alt={inviter.name} />
            <AvatarFallback>
              {inviter.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">{inviter.name}</span>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const invitation = row.original;
      return (
        <div className="text-right">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("cancelInvitationTrigger", {
                  detail: {
                    invitationId: invitation.id,
                    email: invitation.email,
                  },
                })
              )
            }
            title={t("pages.members.cancelInvitation")}
          >
            <X className="h-4 w-4 text-muted-foreground hover:text-red-500" />
          </Button>
        </div>
      );
    },
  },
];

const createMemberColumns = (
  t: TranslateFn
): ColumnDef<{
  userId: string;
  organizationId: string;
  role: "member" | "admin" | "owner";
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
  };
}>[] => [
  {
    accessorKey: "user",
    header: t("pages.members.member"),
    cell: ({ row }) => {
      const user = row.getValue("user") as {
        id: string;
        name: string;
        email?: string;
        avatarUrl?: string;
      };
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
        <Badge variant={getRoleBadgeVariant(role)}>
          {getRoleLabel(role, t)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: t("pages.members.joined"),
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date;
      return <div>{formatDate(date)}</div>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const membership = row.original;
      const isOwner = membership.role === "owner";

      if (isOwner) {
        return <div></div>;
      }

      return (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-haspopup="true" size="icon" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{t("common.openMenu")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  document.dispatchEvent(
                    new CustomEvent("updateMemberRoleTrigger", {
                      detail: {
                        userId: membership.userId,
                        userName: membership.user.name,
                        userEmail: membership.user.email || "",
                        currentRole: membership.role,
                      },
                    })
                  )
                }
              >
                {t("pages.members.changeRole")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  document.dispatchEvent(
                    new CustomEvent("removeMemberTrigger", {
                      detail: {
                        userId: membership.userId,
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

  const [isInviteMemberDialogOpen, setIsInviteMemberDialogOpen] =
    useState(false);
  const [isUpdateRoleDialogOpen, setIsUpdateRoleDialogOpen] = useState(false);
  const [isRemoveMemberDialogOpen, setIsRemoveMemberDialogOpen] =
    useState(false);
  const [isCancelInvitationDialogOpen, setIsCancelInvitationDialogOpen] =
    useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"member" | "admin">(
    "member"
  );

  const [memberToUpdate, setMemberToUpdate] = useState<{
    userId: string;
    userName: string;
    userEmail: string;
    currentRole: string;
  } | null>(null);
  const [newRole, setNewRole] = useState<"member" | "admin">("member");

  const [memberToRemove, setMemberToRemove] = useState<{
    userId: string;
    userName: string;
    userEmail: string;
  } | null>(null);

  const [invitationToCancel, setInvitationToCancel] = useState<{
    invitationId: string;
    email: string;
  } | null>(null);

  const memberColumns = useMemo(() => createMemberColumns(t), [t]);
  const invitationColumns = useMemo(() => createInvitationColumns(t), [t]);

  const handleInviteMember = useCallback(async (): Promise<void> => {
    if (!newMemberEmail.trim()) {
      appToast.error("pages.members.emailRequired");
      return;
    }

    setIsProcessing(true);
    try {
      await createInvitation(organizationId || "", {
        email: newMemberEmail.trim(),
        role: newMemberRole,
      });

      appToast.success("pages.members.inviteSent");
      setIsInviteMemberDialogOpen(false);
      setNewMemberEmail("");
      setNewMemberRole("member");
      await mutateInvitations();
    } catch (error) {
      appToast.error("pages.members.inviteFailed");
      console.error("Send Invitation Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [
    newMemberEmail,
    newMemberRole,
    organizationId,
    mutateInvitations,
    appToast,
  ]);

  const handleUpdateRole = useCallback(async (): Promise<void> => {
    if (!memberToUpdate) return;

    setIsProcessing(true);
    try {
      await updateMembership(organizationId || "", {
        email: memberToUpdate.userEmail,
        role: newRole,
      });

      appToast.success("pages.members.roleUpdated");
      setIsUpdateRoleDialogOpen(false);
      setMemberToUpdate(null);
      setNewRole("member");
      await mutateMemberships();
    } catch (error) {
      appToast.error("pages.members.roleUpdateFailed");
      console.error("Update Role Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [memberToUpdate, newRole, organizationId, mutateMemberships, appToast]);

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
      console.error("Remove Member Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [memberToRemove, organizationId, mutateMemberships, appToast]);

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
      console.error("Cancel Invitation Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [invitationToCancel, organizationId, mutateInvitations, appToast]);

  const handleUpdateRoleEvent = useCallback((e: Event) => {
    const custom = e as CustomEvent<{
      userId: string;
      userName: string;
      userEmail: string;
      currentRole: string;
    }>;
    if (custom.detail) {
      setMemberToUpdate(custom.detail);
      setNewRole(custom.detail.currentRole as "member" | "admin");
      setIsUpdateRoleDialogOpen(true);
    }
  }, []);

  const handleRemoveMemberEvent = useCallback((e: Event) => {
    const custom = e as CustomEvent<{
      userId: string;
      userName: string;
      userEmail: string;
    }>;
    if (custom.detail) {
      setMemberToRemove(custom.detail);
      setIsRemoveMemberDialogOpen(true);
    }
  }, []);

  const handleCancelInvitationEvent = useCallback((e: Event) => {
    const custom = e as CustomEvent<{
      invitationId: string;
      email: string;
    }>;
    if (custom.detail) {
      setInvitationToCancel(custom.detail);
      setIsCancelInvitationDialogOpen(true);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("updateMemberRoleTrigger", handleUpdateRoleEvent);
    document.addEventListener("removeMemberTrigger", handleRemoveMemberEvent);
    document.addEventListener(
      "cancelInvitationTrigger",
      handleCancelInvitationEvent
    );

    return () => {
      document.removeEventListener(
        "updateMemberRoleTrigger",
        handleUpdateRoleEvent
      );
      document.removeEventListener(
        "removeMemberTrigger",
        handleRemoveMemberEvent
      );
      document.removeEventListener(
        "cancelInvitationTrigger",
        handleCancelInvitationEvent
      );
    };
  }, [
    handleUpdateRoleEvent,
    handleRemoveMemberEvent,
    handleCancelInvitationEvent,
  ]);

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.members") }]);
  }, [setBreadcrumbs, t]);

  if (isMembershipsLoading && !memberships) {
    return <InsetLoading title={t("pages.members.loadingTitle")} />;
  } else if (membershipsError) {
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
        <Button onClick={() => setIsInviteMemberDialogOpen(true)}>
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

      <AlertDialog
        open={isInviteMemberDialogOpen}
        onOpenChange={setIsInviteMemberDialogOpen}
      >
        <AlertDialogContent>
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
                placeholder={t("pages.members.emailPlaceholder")}
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">{t("pages.members.role")}</Label>
              <Select
                value={newMemberRole}
                onValueChange={(value: "member" | "admin") =>
                  setNewMemberRole(value)
                }
                disabled={isProcessing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    {t("pages.members.roles.member")}
                  </SelectItem>
                  <SelectItem value="admin">
                    {t("pages.members.roles.admin")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setNewMemberEmail("");
                setNewMemberRole("member");
              }}
            >
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleInviteMember}
              disabled={isProcessing || !newMemberEmail.trim()}
            >
              {isProcessing
                ? t("common.loading")
                : t("pages.members.sendInvitation")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isUpdateRoleDialogOpen}
        onOpenChange={setIsUpdateRoleDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.members.updateRoleTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.members.updateRoleDescription", {
                name: memberToUpdate?.userName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-role">{t("pages.members.newRole")}</Label>
              <Select
                value={newRole}
                onValueChange={(value: "member" | "admin") => setNewRole(value)}
                disabled={isProcessing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">
                    {t("pages.members.roles.member")}
                  </SelectItem>
                  <SelectItem value="admin">
                    {t("pages.members.roles.admin")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMemberToUpdate(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUpdateRole}
              disabled={isProcessing}
            >
              {isProcessing
                ? t("common.loading")
                : t("pages.members.updateRole")}
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
              onClick={handleRemoveMember}
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
              {t("pages.members.keepInvitation")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvitation}
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
