import { toast } from "sonner";

import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";

export function useAppToast() {
  const { t } = useTranslation();

  return {
    success(key: TranslationKey, params?: Record<string, string | number>) {
      toast.success(t(key, params));
    },
    warning(key: TranslationKey, params?: Record<string, string | number>) {
      toast.warning(t(key, params));
    },
    error(key: TranslationKey, params?: Record<string, string | number>) {
      toast.error(t(key, params));
    },
    errorRaw(message: string) {
      toast.error(message);
    },
    info(key: TranslationKey, params?: Record<string, string | number>) {
      toast.info(t(key, params));
    },
  };
}
