import LoaderIcon from "lucide-react/icons/loader-circle";
import Upload from "lucide-react/icons/upload";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";

import { GENERATIVE_CARD_STATE_LABEL_CLASS } from "./generative-card-styles";
import {
  formatGenerativeCardUploadFileTypes,
  type GenerativeCardUploadKind,
} from "./generative-card-upload-utils";
import { TEXT_CARD_UPLOAD_DISPLAY_TYPES } from "./text-card-upload-utils";
import { cn } from "@/utils/utils";

export type CardEmptyUploadKind = GenerativeCardUploadKind | "text";

export interface GenerativeCardEmptyUploadSlotProps {
  readonly kind: CardEmptyUploadKind;
  readonly canUpload: boolean;
  readonly onUploadClick: () => void;
  readonly doubleClickHintKey?: TranslationKey;
  readonly busy?: boolean;
  readonly busyMessage?: string;
  readonly size?: "canvas" | "studio-detail";
  readonly className?: string;
}

export function GenerativeCardEmptyUploadSlot({
  kind,
  canUpload,
  onUploadClick,
  doubleClickHintKey,
  busy = false,
  busyMessage,
  size = "canvas",
  className,
}: GenerativeCardEmptyUploadSlotProps) {
  const { t } = useTranslation();
  const isDetail = size === "studio-detail";
  const fileTypes =
    kind === "text"
      ? TEXT_CARD_UPLOAD_DISPLAY_TYPES
      : formatGenerativeCardUploadFileTypes(kind);
  const i18nPrefix =
    kind === "text"
      ? "workflow.aiTextPanel"
      : kind === "image"
        ? "workflow.aiImagePanel"
        : kind === "video"
          ? "workflow.aiVideoPanel"
          : "workflow.aiAudioPanel";

  if (busy) {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 px-3",
          className
        )}
      >
        <LoaderIcon
          className={cn(
            "animate-spin text-yellow-500",
            isDetail ? "h-6 w-6" : "h-5 w-5"
          )}
          aria-hidden
        />
        {busyMessage ? (
          <p
            className={cn(
              GENERATIVE_CARD_STATE_LABEL_CLASS,
              isDetail ? "text-sm" : "text-base"
            )}
          >
            {busyMessage}
          </p>
        ) : null}
      </div>
    );
  }

  if (!canUpload) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 px-3",
        className
      )}
    >
      {doubleClickHintKey ? (
        <p
          className={cn(
            "text-center text-muted-foreground/50",
            isDetail ? "text-sm" : "text-xs"
          )}
        >
          {t(doubleClickHintKey)}
        </p>
      ) : null}
      <button
        type="button"
        className={cn(
          "nodrag nopan nowheel flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border/60 bg-background/40 px-4 py-3 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
          isDetail ? "py-4" : "py-3"
        )}
        title={t(`${i18nPrefix}.cardUploadAction`)}
        aria-label={t(`${i18nPrefix}.cardUploadAction`)}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onUploadClick();
        }}
      >
        <Upload
          className={cn("shrink-0 opacity-70", isDetail ? "h-7 w-7" : "h-6 w-6")}
          aria-hidden
        />
        <span className={cn("font-medium", isDetail ? "text-sm" : "text-xs")}>
          {t(`${i18nPrefix}.cardUploadAction`)}
        </span>
      </button>
      <p
        className={cn(
          "text-center text-muted-foreground/50",
          isDetail ? "text-xs" : "text-[11px]"
        )}
      >
        {t(`${i18nPrefix}.cardUploadFileTypes`, { types: fileTypes })}
      </p>
    </div>
  );
}
