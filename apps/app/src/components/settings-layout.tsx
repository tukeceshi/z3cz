import Building2 from "lucide-react/icons/building-2";
import Mail from "lucide-react/icons/mail";
import User from "lucide-react/icons/user";
import { ReactNode } from "react";

import { AppLayout } from "@/components/layouts/app-layout";
import { useTranslation } from "@/components/locale-provider";

interface SettingsLayoutProps {
  children: ReactNode;
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const { t } = useTranslation();

  return (
    <AppLayout
      sidebar={{
        title: t("nav.settings"),
        groups: [
          {
            items: [
              {
                id: "profile",
                title: t("userMenu.profile"),
                url: "/settings/profile",
                icon: User,
              },
              {
                id: "organizations",
                title: t("userMenu.organizations"),
                url: "/settings/organizations",
                icon: Building2,
              },
              {
                id: "invitations",
                title: t("userMenu.invitations"),
                url: "/settings/invitations",
                icon: Mail,
              },
            ],
          },
        ],
        footerItems: [],
      }}
    >
      {children}
    </AppLayout>
  );
}
