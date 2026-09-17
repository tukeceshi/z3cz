import { toast } from "sonner";

import { useTranslation } from "@/components/locale-provider";

export function useAppToast() {
  const { t } = useTranslation();

  return {
    success(key: string, params?: Record<string, string | number>) {
      toast.success(t(key, params));
    },
    warning(key: string, params?: Record<string, string | number>) {
      toast.warning(t(key, params));
    },
    error(key: string, params?: Record<string, string | number>) {
      toast.error(t(key, params));
    },
    errorRaw(message: string) {
      toast.error(message);
    },
    info(key: string, params?: Record<string, string | number>) {
      toast.info(t(key, params));
    },
  };
}
