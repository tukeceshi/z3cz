import type { Integration } from "@dafthunk/types";
import MoreHorizontal from "lucide-react/icons/more-horizontal";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface IntegrationActionsProps {
  integration: Integration;
  onDelete: (integrationId: string) => void;
}

export function IntegrationActions({
  integration,
  onDelete,
}: IntegrationActionsProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-haspopup="true" size="icon" variant="ghost">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{t("common.openMenu")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onDelete(integration.id)}>
          {t("pages.integrations.disconnect")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
