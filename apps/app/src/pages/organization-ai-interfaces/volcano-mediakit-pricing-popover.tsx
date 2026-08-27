import Info from "lucide-react/icons/info";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { VolcanoMediaKitPricingTable } from "./volcano-mediakit-pricing-table";

export function VolcanoMediaKitPricingPopover() {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Info className="mr-1 size-3.5" />
          {t("pages.aiInterfaces.volcano.pricingPopover")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[min(40rem,calc(100vw-2rem))] p-3"
        align="start"
      >
        <VolcanoMediaKitPricingTable compact />
      </PopoverContent>
    </Popover>
  );
}
