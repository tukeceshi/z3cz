import Cloud from "lucide-react/icons/cloud";
import Move from "lucide-react/icons/move";
import Sparkles from "lucide-react/icons/sparkles";
import Users from "lucide-react/icons/users";
import type { LucideIcon } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { cn } from "@/utils/utils";

const LANDING_CARD_CLASS =
  "bg-white dark:bg-neutral-800 dark:border-neutral-700";

interface CanvasFeature {
  readonly icon: LucideIcon;
  readonly titleKey: TranslationKey;
  readonly descKey: TranslationKey;
}

const CANVAS_FEATURES: readonly CanvasFeature[] = [
  {
    icon: Move,
    titleKey: "landing.valueCanvas",
    descKey: "landing.valueCanvasDesc",
  },
  {
    icon: Sparkles,
    titleKey: "landing.canvasItemGenerate",
    descKey: "landing.canvasItemGenerateDesc",
  },
  {
    icon: Users,
    titleKey: "landing.valueCollab",
    descKey: "landing.valueCollabDesc",
  },
  {
    icon: Cloud,
    titleKey: "landing.valueStorage",
    descKey: "landing.valueStorageDesc",
  },
];

export function LandingCanvasSection() {
  const { t } = useTranslation();

  return (
    <section id="canvas" className="scroll-mt-20 py-4 md:py-6">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold md:text-3xl">
            {t("landing.valueCanvas")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            {t("landing.canvasSectionDesc")}
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {CANVAS_FEATURES.map(({ icon: Icon, titleKey, descKey }) => (
            <div
              key={titleKey}
              className={cn(
                "rounded-xl border p-4 md:p-5",
                LANDING_CARD_CLASS
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 text-left">
                  <h3 className="font-medium">{t(titleKey)}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(descKey)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
