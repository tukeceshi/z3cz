import ChevronDown from "lucide-react/icons/chevron-down";
import Trash2 from "lucide-react/icons/trash-2";
import type { ReactNode } from "react";

import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

import { ModelChipList, type ModelChipEntry } from "./model-chip-list";

interface InterfaceCardShellProps {
  readonly title: string;
  readonly titleBadge?: ReactNode;
  readonly enabledModelChips: readonly ModelChipEntry[];
  readonly expanded: boolean;
  readonly onExpandToggle: () => void;
  readonly onDelete: () => void;
  readonly leadingActions?: ReactNode;
  readonly collapsedHint?: ReactNode;
  readonly children?: ReactNode;
}

export function InterfaceCardShell({
  title,
  titleBadge,
  enabledModelChips,
  expanded,
  onExpandToggle,
  onDelete,
  leadingActions,
  collapsedHint,
  children,
}: InterfaceCardShellProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {titleBadge}
            <p className="truncate font-medium" title={title}>
              {title}
            </p>
          </div>

          {!expanded ? (
            <div className="space-y-1.5">
              <ModelChipList models={enabledModelChips} />
              {collapsedHint}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {expanded ? leadingActions : null}
          <Button variant="outline" size="sm" onClick={onExpandToggle}>
            <ChevronDown
              className={cn(
                "mr-1.5 size-4 transition-transform",
                expanded ? "rotate-180" : ""
              )}
            />
            {expanded
              ? t("pages.aiInterfaces.volcano.collapse")
              : t("pages.aiInterfaces.volcano.expand")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            {t("pages.aiInterfaces.deleteButton")}
          </Button>
        </div>
      </div>

      {expanded ? children : null}
    </div>
  );
}

export function ApiChannelBadge() {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className="shrink-0 font-normal">
      {t("pages.aiInterfaces.apiChannelBadge")}
    </Badge>
  );
}

export function AggregateChannelBadge() {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className="shrink-0 font-normal">
      {t("pages.aiInterfaces.aggregateChannelBadge")}
    </Badge>
  );
}
