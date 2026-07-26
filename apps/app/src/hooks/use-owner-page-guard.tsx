import type { ReactElement } from "react";

import { OrgPermissionGate } from "@/components/org-permission-gate";
import { useTranslation } from "@/components/locale-provider";
import type { TranslationKey } from "@/i18n";
import { useOrgPermissions } from "@/hooks/use-org-permissions";

export function useOwnerPageGuard(titleKey: TranslationKey): {
  blocked: boolean;
  gate: ReactElement | null;
} {
  const { t } = useTranslation();
  const perms = useOrgPermissions();

  if (perms.canManageResources) {
    return { blocked: false, gate: null };
  }

  return {
    blocked: true,
    gate: (
      <OrgPermissionGate allowed={false} title={t(titleKey)}>
        {null}
      </OrgPermissionGate>
    ),
  };
}
