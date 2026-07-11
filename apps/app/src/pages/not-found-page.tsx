import { Link } from "react-router";

import { InsetLayout } from "@/components/layouts/inset-layout";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <InsetLayout className="grid place-items-center h-full">
      <div className="flex flex-col items-center justify-center">
        <img
          src="/404.svg"
          alt={t("pages.notFound.imageAlt")}
          className="h-32 mb-8 dark:invert"
        />
        <h2 className="text-xl font-semibold mb-4">{t("pages.notFound.title")}</h2>
        <p className="text-muted-foreground mb-8">
          {t("pages.notFound.description")}
        </p>
        <Button asChild>
          <Link to="/">{t("pages.notFound.homeButton")}</Link>
        </Button>
      </div>
    </InsetLayout>
  );
}
