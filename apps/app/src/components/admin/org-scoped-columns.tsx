import type { ColumnDef } from "@tanstack/react-table";
import { Link, type useNavigate } from "react-router";

import { RowActionsMenu } from "@/components/admin/row-actions-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { TranslateFn } from "@/i18n";
import { formatDate } from "@/utils/date";

export interface OrgScopedRow {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
  createdAt: Date;
}

export function createOrgScopedColumns<T extends OrgScopedRow>(
  navigate: ReturnType<typeof useNavigate>,
  t: TranslateFn
): ColumnDef<T>[] {
  return [
    {
      accessorKey: "name",
      header: t("admin.common.name"),
      cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
    },
    {
      accessorKey: "organizationName",
      header: t("admin.common.organization"),
      cell: ({ row }) => (
        <Link
          to={`/admin/organizations/${row.original.organizationId}`}
          className="hover:underline"
        >
          {row.original.organizationName}
        </Link>
      ),
    },
    {
      accessorKey: "createdAt",
      header: t("admin.common.created"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.createdAt)}
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
            {t("admin.common.viewOrganization")}
          </DropdownMenuItem>
        </RowActionsMenu>
      ),
    },
  ];
}
