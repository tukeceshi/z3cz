import CircleAlertIcon from "lucide-react/icons/circle-alert";
import { useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface VideoTrimLocalTrimHintIconProps {
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

export function VideoTrimLocalTrimHintIcon({
  open: openProp,
  onOpenChange,
}: VideoTrimLocalTrimHintIconProps = {}) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (openProp === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <Popover modal={false} open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("workflow.videoTrim.localTrimHint.title")}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-700/60"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <CircleAlertIcon className="size-3.5" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 space-y-1.5 p-3 text-xs text-muted-foreground"
        align="start"
        side="top"
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p>{t("workflow.videoTrim.localTrimHint.line1")}</p>
        <p>{t("workflow.videoTrim.localTrimHint.line2")}</p>
        <p>{t("workflow.videoTrim.localTrimHint.line3")}</p>
        <p>{t("workflow.videoTrim.localTrimHint.line4")}</p>
      </PopoverContent>
    </Popover>
  );
}
