import {
  formatMediaKitYuanPerSecond,
  listVolcanoMediaKitSubtitleErasePricingModes,
  listVolcanoMediaKitVideoEnhancePricingModes,
  VOLCANO_MEDIKIT_PRICING_DOC_URL,
  VOLCANO_MEDIKIT_PRICING_RESOLUTIONS,
  VOLCANO_MEDIKIT_PRICING_TABLE,
  VOLCANO_MEDIKIT_SUBTITLE_ERASE_PRICING,
} from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface VolcanoMediaKitPricingTableProps {
  readonly compact?: boolean;
}

export function VolcanoMediaKitPricingTable({
  compact = false,
}: VolcanoMediaKitPricingTableProps) {
  const { t } = useTranslation();
  const videoModes = listVolcanoMediaKitVideoEnhancePricingModes();
  const subtitleModes = listVolcanoMediaKitSubtitleErasePricingModes();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {!compact ? (
          <p className="text-sm font-medium">
            {t("pages.aiInterfaces.mediaKitEnhance.videoEnhanceSection")}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {t("pages.aiInterfaces.mediaKitEnhance.pricingFpsHint")}
        </p>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">
                  {t("pages.aiInterfaces.mediaKitEnhance.pricingVersionColumn")}
                </TableHead>
                {VOLCANO_MEDIKIT_PRICING_RESOLUTIONS.map((resolution) => (
                  <TableHead
                    key={resolution}
                    className="whitespace-nowrap text-right"
                  >
                    {resolution}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {videoModes.map((mode) => (
                <TableRow key={mode}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {t(`pages.aiInterfaces.mediaKitEnhance.modes.${mode}`)}
                  </TableCell>
                  {VOLCANO_MEDIKIT_PRICING_RESOLUTIONS.map((resolution) => {
                    const yuanPerMinute =
                      VOLCANO_MEDIKIT_PRICING_TABLE[mode][resolution];
                    return (
                      <TableCell
                        key={resolution}
                        className="whitespace-nowrap text-right text-xs tabular-nums"
                      >
                        {yuanPerMinute === null
                          ? "—"
                          : formatMediaKitYuanPerSecond(yuanPerMinute)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-2">
        {!compact ? (
          <p className="text-sm font-medium">
            {t("pages.aiInterfaces.mediaKitEnhance.subtitleEraseSection")}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {t("pages.aiInterfaces.mediaKitEnhance.subtitleErasePricingHint")}
        </p>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">
                  {t("pages.aiInterfaces.mediaKitEnhance.pricingVersionColumn")}
                </TableHead>
                <TableHead className="whitespace-nowrap text-right">
                  {t("pages.aiInterfaces.mediaKitEnhance.pricingPriceColumn")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subtitleModes.map((mode) => (
                <TableRow key={mode}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {t(
                      `pages.aiInterfaces.mediaKitEnhance.subtitleEraseModes.${mode}`
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs tabular-nums">
                    {formatMediaKitYuanPerSecond(
                      VOLCANO_MEDIKIT_SUBTITLE_ERASE_PRICING[mode]
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <a
        href={VOLCANO_MEDIKIT_PRICING_DOC_URL}
        target="_blank"
        rel="noreferrer"
        className="text-primary text-xs underline-offset-4 hover:underline"
      >
        {t("pages.aiInterfaces.mediaKitEnhance.pricingMoreFpsLink")}
      </a>
    </div>
  );
}
