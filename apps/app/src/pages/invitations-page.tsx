import type { UserInvitation } from "@dafthunk/types";
import type { ColumnDef } from "@tanstack/react-table";
import Check from "lucide-react/icons/check";
import X from "lucide-react/icons/x";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/components/locale-provider";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
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
import { useAppToast } from "@/hooks/use-app-toast";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import type { TranslateFn } from "@/i18n";
import {
  acceptInvitation,
  declineInvitation,
  useOrganizations,
  useUserInvitations,
} from "@/services/organizations-service";
import { formatDate } from "@/utils/date";

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case "admin":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
};

const getRoleLabel = (role: string, t: TranslateFn) => {
  if (role === "admin") return t("pages.members.roles.admin");
  if (role === "owner") return t("pages.members.roles.owner");
  return t("pages.members.roles.member");
};

const createInvitationColumns = (t: TranslateFn): ColumnDef<UserInvitation>[] => [
  {
    accessorKey: "organization",
    header: t("pages.invitations.organization"),
    cell: ({ row }) => {
      return (
        <div className="font-medium">{row.original.organization.name}</div>
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
      return <div>{formatDate(date)}</div>;
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
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("acceptInvitationTrigger", {
                  detail: {
                    invitationId: invitation.id,
                    organizationName: invitation.organization.name,
                  },
                })
              )
            }
          >
            <Check className="h-4 w-4 mr-1" />
            {t("pages.invitations.accept")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              document.dispatchEvent(
                new CustomEvent("declineInvitationTrigger", {
                  detail: {
                    invitationId: invitation.id,
                    organizationName: invitation.organization.name,
                  },
                })
              )
            }
          >
            <X className="h-4 w-4 mr-1" />
            {t("pages.invitations.decline")}
          </Button>
        </div>
      );
    },
  },
];

export function InvitationsPage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { invitations, isInvitationsLoading, mutateInvitations } =
    useUserInvitations();
  const { mutateOrganizations } = useOrganizations();

  useEffect(() => {
    setBreadcrumbs([{ label: t("userMenu.invitations") }]);
  }, [setBreadcrumbs, t]);

  const [isAcceptDialogOpen, setIsAcceptDialogOpen] = useState(false);
  const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<{
    invitationId: string;
    organizationName: string;
  } | null>(null);

  const invitationColumns = createInvitationColumns(t);

  const handleAcceptInvitation = useCallback(async (): Promise<void> => {
    if (!selectedInvitation) return;

    setIsProcessing(true);
    try {
      await acceptInvitation(selectedInvitation.invitationId);

      appToast.success("pages.invitations.acceptedToast", {
        name: selectedInvitation.organizationName,
      });
      setIsAcceptDialogOpen(false);
      setSelectedInvitation(null);
      await mutateInvitations();
      await mutateOrganizations();
    } catch (error) {
      appToast.error("pages.invitations.acceptFailed");
      console.error("Accept Invitation Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedInvitation, mutateInvitations, mutateOrganizations, appToast]);

  const handleDeclineInvitation = useCallback(async (): Promise<void> => {
    if (!selectedInvitation) return;

    setIsProcessing(true);
    try {
      await declineInvitation(selectedInvitation.invitationId);

      appToast.success("pages.invitations.declinedToast");
      setIsDeclineDialogOpen(false);
      setSelectedInvitation(null);
      await mutateInvitations();
    } catch (error) {
      appToast.error("pages.invitations.declineFailed");
      console.error("Decline Invitation Error:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedInvitation, mutateInvitations, appToast]);

  const handleAcceptEvent = useCallback((e: Event) => {
    const custom = e as CustomEvent<{
      invitationId: string;
      organizationName: string;
    }>;
    if (custom.detail) {
      setSelectedInvitation(custom.detail);
      setIsAcceptDialogOpen(true);
    }
  }, []);

  const handleDeclineEvent = useCallback((e: Event) => {
    const custom = e as CustomEvent<{
      invitationId: string;
      organizationName: string;
    }>;
    if (custom.detail) {
      setSelectedInvitation(custom.detail);
      setIsDeclineDialogOpen(true);
    }
  }, []);

  if (typeof document !== "undefined") {
    document.removeEventListener("acceptInvitationTrigger", handleAcceptEvent);
    document.removeEventListener(
      "declineInvitationTrigger",
      handleDeclineEvent
    );
    document.addEventListener("acceptInvitationTrigger", handleAcceptEvent);
    document.addEventListener("declineInvitationTrigger", handleDeclineEvent);
  }

  if (isInvitationsLoading && !invitations) {
    return <InsetLoading title={t("pages.invitations.title")} />;
  }

  return (
    <InsetLayout title={t("pages.invitations.title")}>
      <div className="flex items-center justify-between mb-6 min-h-10">
        <div className="text-sm text-muted-foreground max-w-2xl">
          {t("pages.invitations.description")}
        </div>
      </div>

      <DataTable
        columns={invitationColumns}
        data={invitations || []}
        emptyState={{
          title: t("pages.invitations.emptyTitle"),
          description: t("pages.invitations.emptyDescription"),
        }}
      />

      <AlertDialog
        open={isAcceptDialogOpen}
        onOpenChange={setIsAcceptDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.invitations.acceptTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.invitations.acceptDescription", {
                name: selectedInvitation?.organizationName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedInvitation(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAcceptInvitation}
              disabled={isProcessing}
            >
              {isProcessing
                ? t("common.loading")
                : t("pages.invitations.acceptInvitation")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isDeclineDialogOpen}
        onOpenChange={setIsDeclineDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.invitations.declineTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.invitations.declineDescription", {
                name: selectedInvitation?.organizationName ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedInvitation(null)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeclineInvitation}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing
                ? t("common.loading")
                : t("pages.invitations.declineInvitation")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InsetLayout>
  );
}
