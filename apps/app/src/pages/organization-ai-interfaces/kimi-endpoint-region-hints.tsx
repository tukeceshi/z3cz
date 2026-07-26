import { KIMI_ENDPOINT_REGION_HINTS } from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";

const KIMI_REGION_LABEL_KEYS = {
  domestic: "pages.aiInterfaces.singleModel.kimiRegionDomestic",
  overseas: "pages.aiInterfaces.singleModel.kimiRegionOverseas",
} as const;

export function KimiEndpointRegionHints() {
  const { t } = useTranslation();

  return (
    <div className="space-y-0.5">
      {KIMI_ENDPOINT_REGION_HINTS.map((hint) => (
        <p key={hint.region} className="text-muted-foreground text-xs">
          {t(KIMI_REGION_LABEL_KEYS[hint.region])}: {hint.url}
        </p>
      ))}
    </div>
  );
}
