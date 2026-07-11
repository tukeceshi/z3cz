import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { useTranslation } from "@/components/locale-provider";

interface OAuthCallbackOptions {
  onSuccess?: () => void;
  onError?: () => void;
}

const OAUTH_ERROR_KEYS: Record<string, string> = {
  oauth_failed: "pages.integrations.oauthFailed",
  invalid_state: "pages.integrations.invalidState",
  expired_state: "pages.integrations.expiredState",
  not_authenticated: "pages.integrations.notAuthenticated",
  organization_mismatch: "pages.integrations.organizationMismatch",
};

/**
 * Hook to handle OAuth callback parameters
 * Displays success/error toasts and clears URL parameters
 */
export function useOAuthCallback(options: OAuthCallbackOptions = {}) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      toast.success(t("pages.integrations.connectedSuccess"));
      options.onSuccess?.();
      setSearchParams({});
    } else if (error) {
      const messageKey = OAUTH_ERROR_KEYS[error];
      toast.error(
        messageKey ? t(messageKey) : t("pages.integrations.connectFailed")
      );
      options.onError?.();
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, options, t]);
}
