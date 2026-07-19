import {
  volcanoTosPricingForRegion,
  type VolcanoTosRegionPricingSnapshot,
} from "@dafthunk/types";
import ExternalLink from "lucide-react/icons/external-link";

import { useTranslation } from "@/components/locale-provider";

interface VolcanoTosPricingLinesProps {
  readonly pricing: VolcanoTosRegionPricingSnapshot | null | undefined;
  readonly region: string;
}

export function VolcanoTosPricingLines({
  pricing,
  region,
}: VolcanoTosPricingLinesProps) {
  const { t } = useTranslation();
  const resolved = pricing ?? volcanoTosPricingForRegion(region);
  if (!resolved) return null;

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>
        {t("pages.aiInterfaces.tosStorage.standardStoragePrice")}:{" "}
        <span className="text-foreground">{resolved.standardStorageLabel}</span>
      </p>
      <p>
        {t("pages.aiInterfaces.tosStorage.publicEgressPrice")}:{" "}
        <span className="text-foreground">{resolved.publicEgressLabel}</span>
      </p>
      <a
        href={resolved.docUrl}
        target="_blank"
        rel="noreferrer"
        className="text-primary inline-flex items-center gap-1 hover:underline underline-offset-4"
      >
        {t("pages.aiInterfaces.tosStorage.pricingDoc")}
        <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
