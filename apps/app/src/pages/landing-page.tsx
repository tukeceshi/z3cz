import type { LegalDocumentType } from "@dafthunk/types";
import Github from "lucide-react/icons/github";
import Menu from "lucide-react/icons/menu";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { LandingBillingSection } from "@/components/landing-billing-section";
import { LanguageToggle } from "@/components/language-toggle";
import { LegalDocumentDialog } from "@/components/legal-document-dialog";
import { useLoginDialog } from "@/components/login-dialog";
import { useTranslation } from "@/components/locale-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfile } from "@/components/user-profile";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { TranslationKey } from "@/i18n";
import { getDashboardPath } from "@/utils/auth-navigation";
import { scheduleConsolePrefetch } from "@/utils/console-prefetch";

const GITHUB_REPO_URL = "https://github.com/tukeceshi/z3cz";

const VALUE_ITEMS: readonly {
  readonly titleKey: TranslationKey;
  readonly descKey: TranslationKey;
}[] = [
  {
    titleKey: "landing.valueOfficial",
    descKey: "landing.valueOfficialDesc",
  },
  {
    titleKey: "landing.valueStorage",
    descKey: "landing.valueStorageDesc",
  },
  {
    titleKey: "landing.valueCollab",
    descKey: "landing.valueCollabDesc",
  },
  {
    titleKey: "landing.valueCanvas",
    descKey: "landing.valueCanvasDesc",
  },
];

function scrollToId(id: string): void {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function LandingPage() {
  const { t, siteSettings } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { openLogin } = useLoginDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [legalType, setLegalType] = useState<LegalDocumentType | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const dashboardPath =
    isAuthenticated && user ? getDashboardPath(user) : null;

  useEffect(() => {
    scheduleConsolePrefetch();
  }, []);

  useEffect(() => {
    const shouldOpen = searchParams.get("login") === "1";
    const invitation = searchParams.get("subAccountInvitation");
    if (!shouldOpen && !invitation) {
      return;
    }
    if (!isAuthenticated) {
      openLogin({
        goToConsole: false,
        dismissible: true,
        subAccountInvitationId: invitation ?? undefined,
      });
    }
    const next = new URLSearchParams(searchParams);
    next.delete("login");
    next.delete("subAccountInvitation");
    setSearchParams(next, { replace: true });
  }, [isAuthenticated, openLogin, searchParams, setSearchParams]);

  const handleLogin = () => {
    openLogin({ goToConsole: false, dismissible: true });
  };

  const handleStart = () => {
    if (dashboardPath) {
      return;
    }
    openLogin({ goToConsole: true, dismissible: true });
  };

  const githubLink = (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <Github className="h-4 w-4" />
      GitHub
    </a>
  );

  const navLinks = (
    <>
      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={() => {
          scrollToId("intro");
          setMenuOpen(false);
        }}
      >
        {t("landing.navIntro")}
      </button>
      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={() => {
          scrollToId("pricing");
          setMenuOpen(false);
        }}
      >
        {t("landing.navPricing")}
      </button>
      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={() => {
          scrollToId("features");
          setMenuOpen(false);
        }}
      >
        {t("landing.navFeatures")}
      </button>
      {githubLink}
    </>
  );

  return (
    <div className="min-h-svh bg-neutral-100 text-foreground dark:bg-neutral-900">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-neutral-100/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <a href="#intro" className="flex min-w-0 items-center gap-2">
            <img
              src="/icon.svg"
              alt=""
              className="h-7 w-7 shrink-0 dark:invert"
            />
            <span className="truncate text-sm font-semibold">
              {siteSettings.siteName}
            </span>
          </a>
          <nav className="hidden items-center gap-5 md:flex">{navLinks}</nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <LanguageToggle />
            <ThemeToggle />
            {dashboardPath ? (
              <>
                <Button asChild size="sm">
                  <Link to={dashboardPath}>{t("landing.enterConsole")}</Link>
                </Button>
                <UserProfile />
              </>
            ) : (
              <Button size="sm" onClick={handleLogin}>
                {t("landing.loginRegister")}
              </Button>
            )}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  aria-label={t("landing.menuOpen")}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 dark:bg-neutral-900">
                <SheetHeader>
                  <SheetTitle>{siteSettings.siteName}</SheetTitle>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-4">{navLinks}</div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main>
        <section id="intro" className="scroll-mt-20 py-8 md:py-12">
          <div className="mx-auto max-w-6xl px-4 text-center md:px-6">
            <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
              {t("landing.heroTitle")}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground md:text-lg">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {dashboardPath ? (
                <Button asChild>
                  <Link to={dashboardPath}>{t("landing.heroStart")}</Link>
                </Button>
              ) : (
                <Button onClick={handleStart}>{t("landing.heroStart")}</Button>
              )}
              <Button variant="outline" onClick={() => scrollToId("features")}>
                {t("landing.heroGuide")}
              </Button>
            </div>
            <div
              id="features"
              className="mt-8 grid scroll-mt-20 gap-4 text-left grid-cols-2 lg:grid-cols-4"
            >
              {VALUE_ITEMS.map((item) => (
                <div key={item.titleKey}>
                  <p className="text-sm font-medium">{t(item.titleKey)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(item.descKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LandingBillingSection />

        <section className="border-t border-neutral-200 py-8 dark:border-neutral-800">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 md:flex-row md:items-center md:px-6">
            <h2 className="text-2xl font-semibold">{t("landing.ctaTitle")}</h2>
            {dashboardPath ? (
              <Button asChild>
                <Link to={dashboardPath}>{t("landing.enterConsole")}</Link>
              </Button>
            ) : (
              <Button onClick={handleLogin}>{t("landing.loginRegister")}</Button>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 py-8 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 text-sm text-muted-foreground md:px-6">
          <span>{siteSettings.siteName}</span>
          <div className="flex gap-4">
            <button
              type="button"
              className="underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setLegalType("terms")}
            >
              {t("landing.footerTerms")}
            </button>
            <button
              type="button"
              className="underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setLegalType("privacy")}
            >
              {t("landing.footerPrivacy")}
            </button>
          </div>
        </div>
      </footer>

      <LegalDocumentDialog
        type={legalType}
        open={legalType !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLegalType(null);
          }
        }}
      />
    </div>
  );
}
