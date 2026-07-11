import { Info } from "lucide-react";

import { useTranslation } from "@/components/locale-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ResourceFeatureBannerProps {
  variant?: "resource" | "ai-interfaces";
}

export function ResourceFeatureBanner({
  variant = "resource",
}: ResourceFeatureBannerProps) {
  const { t } = useTranslation();

  return (
    <Alert className="mb-4">
      <Info className="h-4 w-4" />
      <AlertDescription>
        {variant === "ai-interfaces"
          ? t("featureSettings.resourceBanner.aiInterfaces")
          : t("featureSettings.resourceBanner.default")}
      </AlertDescription>
    </Alert>
  );
}
