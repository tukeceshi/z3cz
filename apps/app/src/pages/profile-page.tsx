import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/components/locale-provider";
import { InsetError } from "@/components/inset-error";
import { InsetLoading } from "@/components/inset-loading";
import { InsetLayout } from "@/components/layouts/inset-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import { usePageBreadcrumbs } from "@/hooks/use-page";
import type { TranslateFn } from "@/i18n";
import { updateProfile, useProfile } from "@/services/profile-service";
import { getInitials } from "@/utils/user-utils";

const formatProviderName = (
  profile: { githubId?: string; googleId?: string },
  t: TranslateFn
) => {
  if (profile.githubId) return t("pages.profile.providers.github");
  if (profile.googleId) return t("pages.profile.providers.google");
  return t("pages.profile.providers.unknown");
};

const formatRoleName = (role: string | undefined, t: TranslateFn) => {
  if (!role) return t("pages.profile.roles.user");
  return role.charAt(0).toUpperCase() + role.slice(1);
};

export function ProfilePage() {
  const { t } = useTranslation();
  const appToast = useAppToast();
  const { profile, isProfileLoading, profileError, mutateProfile } =
    useProfile();
  const [isUpdating, setIsUpdating] = useState(false);
  const { setBreadcrumbs } = usePageBreadcrumbs([]);

  const handleEarlyAccessToggle = useCallback(
    async (checked: boolean) => {
      if (!profile) return;

      setIsUpdating(true);
      try {
        await updateProfile({ developerMode: checked });
        appToast.success(
          checked
            ? "pages.profile.earlyAccessEnabled"
            : "pages.profile.earlyAccessDisabled"
        );
        await mutateProfile();
      } catch (error) {
        appToast.error("pages.profile.updateFailed");
        console.error("Update profile error:", error);
      } finally {
        setIsUpdating(false);
      }
    },
    [profile, mutateProfile, appToast]
  );

  useEffect(() => {
    setBreadcrumbs([{ label: t("userMenu.profile") }]);
  }, [setBreadcrumbs, t]);

  if (isProfileLoading) {
    return <InsetLoading title={t("pages.profile.title")} />;
  } else if (profileError) {
    return (
      <InsetError
        title={t("pages.profile.title")}
        errorMessage={profileError.message}
      />
    );
  }

  if (!profile) {
    return null;
  }

  const formatPlanName = (plan: string | undefined) => {
    if (!plan) return t("pages.profile.plans.free");
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  const avatarSrc = profile.avatarUrl;

  return (
    <InsetLayout title={t("pages.profile.title")}>
      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="flex items-center gap-4 mb-2">
          <Avatar className="h-14 w-14">
            {avatarSrc && <AvatarImage src={avatarSrc} alt={profile.name} />}
            <AvatarFallback className="text-xl">
              {getInitials(profile.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-xl font-bold">{profile.name}</h1>
            <p className="text-muted-foreground">
              {profile.email || t("common.noEmail")}
            </p>
          </div>
        </div>
        <form className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("pages.profile.name")}
            </label>
            <Input type="text" value={profile.name} readOnly disabled />
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.profile.nameHint")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("pages.profile.email")}
            </label>
            <Input type="email" value={profile.email || ""} readOnly disabled />
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.profile.emailHint")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("pages.profile.authProvider")}
            </label>
            <Input
              type="text"
              value={formatProviderName(profile, t)}
              readOnly
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.profile.authProviderHint")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("pages.profile.role")}
            </label>
            <Input
              type="text"
              value={formatRoleName(profile.role, t)}
              readOnly
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.profile.roleHint")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {t("pages.profile.plan")}
            </label>
            <Input
              type="text"
              value={formatPlanName(profile.plan)}
              readOnly
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.profile.planHint")}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("pages.profile.developerMode")}
                </label>
                <p className="text-xs text-muted-foreground">
                  {t("pages.profile.developerModeHint")}
                </p>
              </div>
              <Switch
                checked={profile.developerMode}
                onCheckedChange={handleEarlyAccessToggle}
                disabled={isUpdating}
              />
            </div>
          </div>
        </form>
      </div>
    </InsetLayout>
  );
}
