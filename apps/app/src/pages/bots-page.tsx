import type { ColumnDef } from "@tanstack/react-table";
import Bot from "lucide-react/icons/bot";
import Hash from "lucide-react/icons/hash";
import MessageCircle from "lucide-react/icons/message-circle";
import MoreHorizontal from "lucide-react/icons/more-horizontal";
import PlusCircle from "lucide-react/icons/plus-circle";
import Send from "lucide-react/icons/send";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAuth } from "@/components/auth-context";
import { useTranslation } from "@/components/locale-provider";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { TranslateFn } from "@/i18n";
import { useOrgUrl } from "@/hooks/use-org-url";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import {
  deleteDiscordBot,
  deleteSlackBot,
  deleteTelegramBot,
  deleteWhatsAppAccount,
  useDiscordBots,
  useSlackBots,
  useTelegramBots,
  useWhatsAppAccounts,
} from "@/services/bot-service";

import { BotsCreateDialog } from "./bots-create-dialog";

interface BotRow {
  id: string;
  type: "discord" | "telegram" | "whatsapp" | "slack";
  name: string;
  tokenLastFour: string;
  createdAt: string | Date;
}

function createColumns(
  getOrgUrl: (path: string) => string,
  openDeleteDialog: (bot: BotRow) => void,
  t: TranslateFn
): ColumnDef<BotRow>[] {
  return [
    {
      accessorKey: "type",
      header: t("pages.bots.type"),
      cell: ({ row }) => {
        const type = row.getValue("type") as BotRow["type"];
        const Icon =
          type === "discord"
            ? Bot
            : type === "whatsapp"
              ? MessageCircle
              : type === "slack"
                ? Hash
                : Send;
        return (
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm capitalize">{type}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "name",
      header: t("common.name"),
      cell: ({ row }) => {
        const bot = row.original;
        const detailUrl = getOrgUrl(`bots/${bot.type}/${bot.id}`);
        return (
          <Link
            to={detailUrl}
            className="font-medium text-primary hover:underline"
          >
            {bot.name || t("pages.bots.untitled")}
          </Link>
        );
      },
    },
    {
      accessorKey: "tokenLastFour",
      header: t("pages.bots.token"),
      cell: ({ row }) => {
        const lastFour = row.getValue("tokenLastFour") as string;
        return (
          <span className="text-sm text-muted-foreground">****{lastFour}</span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const bot = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">{t("common.openMenu")}</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={getOrgUrl(`bots/${bot.type}/${bot.id}`)}>
                    {t("common.edit")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDeleteDialog(bot)}>
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}

export function BotsPage() {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState<BotRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { setBreadcrumbs } = usePageBreadcrumbs([]);
  const { organization } = useAuth();
  const { getOrgUrl } = useOrgUrl();
  const navigate = useNavigate();
  const orgId = organization?.id || "";

  const {
    discordBots,
    discordBotsError,
    isDiscordBotsLoading,
    mutateDiscordBots,
  } = useDiscordBots();

  const {
    telegramBots,
    telegramBotsError,
    isTelegramBotsLoading,
    mutateTelegramBots,
  } = useTelegramBots();

  const { slackBots, slackBotsError, isSlackBotsLoading, mutateSlackBots } =
    useSlackBots();

  const {
    whatsappAccounts,
    whatsappAccountsError,
    isWhatsAppAccountsLoading,
    mutateWhatsAppAccounts,
  } = useWhatsAppAccounts();

  useEffect(() => {
    setBreadcrumbs([{ label: t("sidebar.bots") }]);
  }, [setBreadcrumbs, t]);

  const isLoading =
    isDiscordBotsLoading ||
    isTelegramBotsLoading ||
    isSlackBotsLoading ||
    isWhatsAppAccountsLoading;
  const error =
    discordBotsError ||
    telegramBotsError ||
    slackBotsError ||
    whatsappAccountsError;

  const rows: BotRow[] = [
    ...(discordBots || []).map((bot) => ({
      id: bot.id,
      type: "discord" as const,
      name: bot.name,
      tokenLastFour: bot.tokenLastFour,
      createdAt: bot.createdAt,
    })),
    ...(telegramBots || []).map((bot) => ({
      id: bot.id,
      type: "telegram" as const,
      name: bot.name,
      tokenLastFour: bot.tokenLastFour,
      createdAt: bot.createdAt,
    })),
    ...(slackBots || []).map((bot) => ({
      id: bot.id,
      type: "slack" as const,
      name: bot.name,
      tokenLastFour: bot.tokenLastFour,
      createdAt: bot.createdAt,
    })),
    ...(whatsappAccounts || []).map((account) => ({
      id: account.id,
      type: "whatsapp" as const,
      name: account.name,
      tokenLastFour: account.tokenLastFour,
      createdAt: account.createdAt,
    })),
  ];

  const openDeleteDialog = (bot: BotRow) => {
    setBotToDelete(bot);
    setDeleteDialogOpen(true);
  };

  const columns = useMemo(
    () => createColumns(getOrgUrl, openDeleteDialog, t),
    [getOrgUrl, t]
  );

  const handleDeleteBot = async () => {
    if (!botToDelete || !orgId) return;
    setIsDeleting(true);
    try {
      if (botToDelete.type === "discord") {
        await deleteDiscordBot(botToDelete.id, orgId);
        mutateDiscordBots();
      } else if (botToDelete.type === "slack") {
        await deleteSlackBot(botToDelete.id, orgId);
        mutateSlackBots();
      } else if (botToDelete.type === "whatsapp") {
        await deleteWhatsAppAccount(botToDelete.id, orgId);
        mutateWhatsAppAccounts();
      } else {
        await deleteTelegramBot(botToDelete.id, orgId);
        mutateTelegramBots();
      }
      setDeleteDialogOpen(false);
      setBotToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreated = (
    botId: string,
    type: "discord" | "telegram" | "whatsapp" | "slack"
  ) => {
    mutateDiscordBots();
    mutateTelegramBots();
    mutateSlackBots();
    mutateWhatsAppAccounts();
    setIsCreateDialogOpen(false);
    navigate(getOrgUrl(`bots/${type}/${botId}`));
  };

  if (isLoading) {
    return <InsetLoading title={t("pages.bots.title")} />;
  } else if (error) {
    return <InsetError title={t("pages.bots.title")} errorMessage={error.message} />;
  }

  return (
    <TooltipProvider>
      <InsetLayout title={t("pages.bots.title")}>
        <div className="flex items-center justify-between mb-6 min-h-10">
          <div className="text-sm text-muted-foreground max-w-2xl">
            {t("pages.bots.description")}
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("pages.bots.addButton")}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={rows}
          emptyState={{
            title: t("pages.bots.emptyTitle"),
            description: t("pages.bots.emptyDescription"),
          }}
        />
        <BotsCreateDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onCreated={handleCreated}
        />
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("pages.bots.deleteTitle")}</DialogTitle>
              <DialogDescription>
                {t("pages.bots.deleteConfirm", {
                  name: botToDelete?.name || t("pages.bots.untitled"),
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeleting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteBot}
                disabled={isDeleting}
              >
                {isDeleting ? <Spinner className="h-4 w-4 mr-2" /> : null}
                {t("common.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </InsetLayout>
    </TooltipProvider>
  );
}
