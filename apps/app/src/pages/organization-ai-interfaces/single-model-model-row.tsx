import type { SingleModelSnapshotRow } from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import { Switch } from "@/components/ui/switch";

import { ModelAliasInlineEdit } from "./model-alias-inline-edit";

interface SingleModelModelRowProps {
  readonly row: SingleModelSnapshotRow;
  readonly disabled?: boolean;
  readonly onEnabledChange?: (enabled: boolean) => void;
  readonly onAliasChange?: (alias: string) => void;
}

export function SingleModelModelRow({
  row,
  disabled = false,
  onEnabledChange,
  onAliasChange,
}: SingleModelModelRowProps) {
  const { t } = useTranslation();
  const modalityShort = t(
    `pages.aiInterfaces.volcano.modalityShort.${row.modality}`
  );

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start gap-3">
        <Switch
          checked={row.enabled}
          disabled={disabled || !onEnabledChange}
          onCheckedChange={(checked) => onEnabledChange?.(checked)}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <ModelAliasInlineEdit
            alias={row.alias}
            modalityLabel={modalityShort}
            disabled={disabled}
            onAliasChange={onAliasChange}
          />
          <span className="text-muted-foreground block text-xs font-mono">
            {row.upstreamModelId}
          </span>
          {!row.enabled ? (
            <p className="text-muted-foreground text-sm">
              {t("pages.aiInterfaces.volcano.disabledHint")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
