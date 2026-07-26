import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";

import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { useTranslation } from "@/components/locale-provider";
import { useAdminOrganizationDetail } from "@/services/admin-service";

/** Redirects legacy /admin/organizations/:id links to the org owner's user detail. */
export function AdminOrganizationRedirectPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { organization, members, organizationError, isOrganizationLoading } =
    useAdminOrganizationDetail(organizationId);

  useEffect(() => {
    if (!organization || members.length === 0) return;
    const owner = members.find((member) => member.role === "owner");
    if (owner) {
      navigate(`/admin/users/${owner.userId}`, { replace: true });
    }
  }, [members, navigate, organization]);

  if (isOrganizationLoading) {
    return <InsetLoading title={t("admin.organizationDetail.title")} />;
  }

  if (organizationError) {
    return (
      <InsetError
        title={t("admin.organizationDetail.title")}
        errorMessage={organizationError.message}
      />
    );
  }

  if (!organization) {
    return (
      <InsetError
        title={t("admin.organizationDetail.title")}
        errorMessage={t("admin.organizationDetail.notFound")}
      />
    );
  }

  const owner = members.find((member) => member.role === "owner");
  if (!owner) {
    return (
      <InsetError
        title={t("admin.organizationDetail.title")}
        errorMessage={t("admin.organizationDetail.noMembers")}
      />
    );
  }

  return <InsetLoading title={t("admin.organizationDetail.title")} />;
}
