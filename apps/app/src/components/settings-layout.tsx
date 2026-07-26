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
