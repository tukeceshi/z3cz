import Hand from "lucide-react/icons/hand";
import MousePointer2 from "lucide-react/icons/mouse-pointer-2";
import MousePointerClick from "lucide-react/icons/mouse-pointer-click";
import type { LucideIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { SURFACE_MUTED_INSET } from "@/components/ui/surface";
import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/utils";

const DISMISS_STORAGE_KEY = "dafthunk.studio.list-hint-dismissed";

function readListInteractionHintDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeListInteractionHintDismissed(): void {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

interface HintLineConfig {
  readonly icon: LucideIcon;
  readonly actionKey: TranslationKey;
  readonly restKey: TranslationKey;
}

const HINT_LINES: readonly HintLineConfig[] = [
  {
    icon: MousePointer2,
    actionKey: "workflow.studio.listInteractionHint.doubleClickAction",
    restKey: "workflow.studio.listInteractionHint.doubleClickRest",
  },
  {
    icon: MousePointerClick,
    actionKey: "workflow.studio.listInteractionHint.singleClickAction",
    restKey: "workflow.studio.listInteractionHint.singleClickRest",
  },
  {
    icon: Hand,
    actionKey: "workflow.studio.listInteractionHint.dragAction",
    restKey: "workflow.studio.listInteractionHint.dragRest",
  },
] as const;

export function CreativeStudioListInteractionHint() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() =>
    readListInteractionHintDismissed()
  );

  const handleDismiss = useCallback(() => {
    writeListInteractionHintDismissed();
    setDismissed(true);
  }, []);

  if (dismissed) {
    return null;
  }

  return (
    <section
      className={cn(
        SURFACE_MUTED_INSET,
        "shrink-0 rounded-lg border border-dashed border-primary/25 bg-primary/8 px-4 py-3"
      )}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <ul className="min-w-0 flex-1 space-y-1.5">
          {HINT_LINES.map(({ icon: Icon, actionKey, restKey }) => (
            <li key={actionKey} className="flex items-start gap-2">
              <Icon
                className="mt-0.5 size-3.5 shrink-0 text-primary/70"
                strokeWidth={2}
                aria-hidden
              />
              <span className="text-sm leading-snug text-foreground/85">
                <span className="font-semibold text-foreground">
                  {t(actionKey)}
                </span>
                {t(restKey)}
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="shrink-0 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          onClick={handleDismiss}
        >
          {t("workflow.studio.listInteractionHint.dismiss")}
        </button>
      </div>
    </section>
  );
}
