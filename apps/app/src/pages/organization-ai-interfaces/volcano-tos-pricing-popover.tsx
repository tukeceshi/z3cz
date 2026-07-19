import {
  volcanoTosPricingForRegion,
  type VolcanoTosRegionPricingSnapshot,
} from "@dafthunk/types";
import Info from "lucide-react/icons/info";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface VolcanoTosPricingPopoverProps {
  readonly pricing: VolcanoTosRegionPricingSnapshot | null | undefined;
  readonly region: string;
  readonly regionLabel?: string;
}

export function VolcanoTosPricingPopover({
  pricing,
  region,
  regionLabel,
}: VolcanoTosPricingPopoverProps) {
  const { t } = useTranslation();
  const resolved = pricing ?? volcanoTosPricingForRegion(region);
  if (!resolved) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Info className="mr-1 size-3.5" />
          {t("pages.aiInterfaces.volcano.pricingPopover")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 text-sm" align="start">
        <p className="font-medium">
          {regionLabel ?? t("pages.aiInterfaces.tosStorage.cardTitle")}
        </p>
        <p className="text-muted-foreground text-xs">
          {t("pages.aiInterfaces.tosStorage.standardStoragePrice")}:{" "}
          {resolved.standardStorageLabel}
        </p>
        <p className="text-muted-foreground text-xs">
          {t("pages.aiInterfaces.tosStorage.publicEgressPrice")}:{" "}
          {resolved.publicEgressLabel}
        </p>
        <a
          href={resolved.docUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary text-xs underline-offset-4 hover:underline"
        >
          {t("pages.aiInterfaces.volcano.pricingDoc")}
        </a>
      </PopoverContent>
    </Popover>
  );
}
