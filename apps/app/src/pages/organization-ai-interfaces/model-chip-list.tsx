import type { AiModelModality } from "@dafthunk/types";
import { formatPlatformModelLabel } from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";

export interface ModelChipEntry {
  readonly canonicalId: string;
  readonly alias: string;
  readonly modality: AiModelModality;
}

interface ModelChipListProps {
  readonly models: readonly ModelChipEntry[];
}

export function ModelChipList({ models }: ModelChipListProps) {
  const { t } = useTranslation();

  if (models.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {t("pages.aiInterfaces.noEnabledModels")}
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {models.map((model) => {
        const modalityShort = t(
          `pages.aiInterfaces.volcano.modalityShort.${model.modality}`
        );
        return (
          <Badge
            key={model.canonicalId}
            variant="secondary"
            className="max-w-full truncate font-normal"
            title={formatPlatformModelLabel({
              alias: model.alias,
              modalityLabel: modalityShort,
            })}
          >
            {formatPlatformModelLabel({
              alias: model.alias,
              modalityLabel: modalityShort,
            })}
          </Badge>
        );
      })}
    </div>
  );
}
