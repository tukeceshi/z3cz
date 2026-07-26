import type { ReactNode } from "react";
import { useTranslation } from "@/components/locale-provider";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OrgPermissionGateProps {
  allowed: boolean;
  children: ReactNode;
  title?: string;
}

export function OrgPermissionGate({
  allowed,
  children,
  title,
}: OrgPermissionGateProps) {
  const { t } = useTranslation();

  if (!allowed) {
    return (
      <InsetLayout title={title ?? t("common.accessDenied")}>
        <Alert variant="destructive">
          <AlertDescription>{t("common.permissionDenied")}</AlertDescription>
        </Alert>
      </InsetLayout>
    );
  }

  return children;
}
