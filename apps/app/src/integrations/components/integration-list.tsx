import type { Integration } from "@dafthunk/types";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import { useTranslation } from "@/components/locale-provider";
import { DataTable } from "@/components/ui/data-table";

import { getProviderLabel } from "../providers";
import { IntegrationActions } from "./integration-actions";

interface IntegrationListProps {
  integrations: Integration[];
  onDelete: (integrationId: string) => void;
}

export function IntegrationList({
  integrations,
  onDelete,
}: IntegrationListProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<Integration>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("pages.integrations.columns.name"),
        cell: ({ row }) => (
          <div className="font-medium">{row.getValue("name")}</div>
        ),
      },
      {
        accessorKey: "provider",
        header: t("pages.integrations.columns.provider"),
        cell: ({ row }) => {
          const providerId = row.getValue(
            "provider"
          ) as Integration["provider"];
          return <div>{getProviderLabel(providerId)}</div>;
        },
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <div className="text-right">
            <IntegrationActions integration={row.original} onDelete={onDelete} />
          </div>
        ),
      },
    ],
    [onDelete, t]
  );

  return (
    <DataTable
      columns={columns}
      data={integrations}
      emptyState={{
        title: t("pages.integrations.list.emptyTitle"),
        description: t("pages.integrations.list.emptyDescription"),
      }}
    />
  );
}
