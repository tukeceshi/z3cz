import type {
  AiInterfaceChannelDefinition,
  AiInterfaceChannelId,
} from "@dafthunk/types";
import { AI_INTERFACE_CHANNELS } from "@dafthunk/types";
import Check from "lucide-react/icons/check";

import { useTranslation } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/utils";

import {
  DashedHintPopover,
  SupportedModelNameGrid,
  supportedModelPopoverWidthClass,
} from "./dashed-hint-popover";
import { useChannelSupportedModels } from "./use-channel-supported-models";

interface ChannelSelectStepProps {
  readonly organizationId: string;
  readonly selectedChannelId: AiInterfaceChannelId | null;
  readonly onSelect: (channelId: AiInterfaceChannelId) => void;
}

function channelTitleKey(id: AiInterfaceChannelId): TranslationKey {
  return id === "volcano"
    ? "pages.aiInterfaces.channels.volcano.title"
    : "pages.aiInterfaces.channels.singleModel.title";
}

function channelSubtitleKey(id: AiInterfaceChannelId): TranslationKey | null {
  return id === "volcano"
    ? "pages.aiInterfaces.channels.volcano.subtitle"
    : null;
}

function channelDescriptionKey(id: AiInterfaceChannelId): TranslationKey {
  return id === "volcano"
    ? "pages.aiInterfaces.channels.volcano.description"
    : "pages.aiInterfaces.channels.singleModel.description";
}

function ChannelCard({
  channel,
  selected,
  onSelect,
  supportedModelNames,
}: {
  channel: AiInterfaceChannelDefinition;
  selected: boolean;
  onSelect: () => void;
  supportedModelNames: readonly string[];
}) {
  const { t } = useTranslation();
  const subtitleKey = channelSubtitleKey(channel.id);
  const isVolcano = channel.id === "volcano";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative w-full rounded-xl border p-4 text-left transition-colors cursor-pointer",
        "hover:border-primary/50 hover:bg-muted/40",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card"
      )}
    >
      {channel.recommended ? (
        <Badge className="absolute top-3 right-3" variant="secondary">
          {t("pages.aiInterfaces.channels.recommended")}
        </Badge>
      ) : null}
      {selected ? (
        <span className="absolute top-3 left-3 inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      ) : null}
      <div className={cn("space-y-2", selected || channel.recommended ? "pt-6" : "")}>
        <div>
          <p className="text-lg font-semibold leading-tight">
            {t(channelTitleKey(channel.id))}
          </p>
          {subtitleKey ? (
            <p className="text-muted-foreground mt-1 text-sm">
              {t(subtitleKey)}
              {isVolcano ? (
                <>
                  <span className="mx-1">·</span>
                  <DashedHintPopover
                    label={t("pages.aiInterfaces.channels.volcano.freeQuota")}
                  >
                    <div className="space-y-1 text-sm leading-relaxed">
                      <p>{t("pages.aiInterfaces.channels.volcano.freeQuotaLine1")}</p>
                      <p>{t("pages.aiInterfaces.channels.volcano.freeQuotaLine2")}</p>
                      <p>{t("pages.aiInterfaces.channels.volcano.freeQuotaLine3")}</p>
                    </div>
                  </DashedHintPopover>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t(channelDescriptionKey(channel.id))}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {channel.tagKeys.map((tagKey) => (
            <Badge key={tagKey} variant="outline" className="font-normal">
              {t(tagKey as TranslationKey)}
            </Badge>
          ))}
          {supportedModelNames.length > 0 ? (
            <DashedHintPopover
              label={t("pages.aiInterfaces.channels.supportedModels")}
              labelClassName="text-xs"
              contentClassName={supportedModelPopoverWidthClass(
                supportedModelNames.length
              )}
            >
              <SupportedModelNameGrid names={supportedModelNames} />
            </DashedHintPopover>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ChannelSelectStep({
  organizationId,
  selectedChannelId,
  onSelect,
}: ChannelSelectStepProps) {
  const { t } = useTranslation();
  const { volcanoModelNames, singleModelNames } =
    useChannelSupportedModels(organizationId);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {t("pages.aiInterfaces.channels.description")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {AI_INTERFACE_CHANNELS.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            selected={selectedChannelId === channel.id}
            onSelect={() => onSelect(channel.id)}
            supportedModelNames={
              channel.id === "volcano" ? volcanoModelNames : singleModelNames
            }
          />
        ))}
      </div>
    </div>
  );
}
