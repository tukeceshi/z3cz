import type { PlatformFeatureConfig, ResourceFeatureId } from "@dafthunk/types";
import {
  DEFAULT_PLATFORM_FEATURE_CONFIG,
  isPlatformFeatureEnabled,
  mergePlatformFeatureConfig,
} from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";

export function useFeatureConfig(): PlatformFeatureConfig {
  const { siteSettings } = useTranslation();
  return mergePlatformFeatureConfig(siteSettings.featureConfig);
}

export function useIsFeatureEnabled(featureId: ResourceFeatureId): boolean {
  const config = useFeatureConfig();
  return isPlatformFeatureEnabled(config, featureId);
}

export { DEFAULT_PLATFORM_FEATURE_CONFIG, isPlatformFeatureEnabled };
