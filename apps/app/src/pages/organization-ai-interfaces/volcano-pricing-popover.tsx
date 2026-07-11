import type { VolcanoSnapshotPricingRow } from "@dafthunk/types";
import Info from "lucide-react/icons/info";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface VolcanoPricingPopoverProps {
  readonly pricing: VolcanoSnapshotPricingRow;
  readonly docUrl: string;
}

export function VolcanoPricingPopover({
  pricing,
  docUrl,
}: VolcanoPricingPopoverProps) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Info className="mr-1 size-3.5" />
          {t("pages.aiInterfaces.volcano.pricingPopover")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 text-sm" align="start">
        <p className="font-medium">{pricing.alias}</p>
        <p>{pricing.priceLabel}</p>
        {pricing.inputPriceLabel && pricing.outputPriceLabel ? (
          <p className="text-muted-foreground text-xs">
            {pricing.inputPriceLabel} / {pricing.outputPriceLabel} ·{" "}
            {pricing.unitLabel}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">{pricing.unitLabel}</p>
        )}
        {pricing.pricingNotes?.map((note) => (
          <p key={note} className="text-muted-foreground text-xs">
            {note}
          </p>
        ))}
        <a
          href={docUrl}
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
