import type { LegalDocumentType } from "@dafthunk/types";
import Github from "lucide-react/icons/github";
import Menu from "lucide-react/icons/menu";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useAuth } from "@/components/auth-context";
import { LandingHeroSection } from "@/components/landing-hero-section";
import { LandingBillingSection } from "@/components/landing-billing-section";
import { LandingCanvasSection } from "@/components/landing-canvas-section";
import { LanguageToggle } from "@/components/language-toggle";
import { LegalDocumentDialog } from "@/components/legal-document-dialog";
import { useTranslation } from "@/components/locale-provider";
import { useLoginDialog } from "@/components/login-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserProfile } from "@/components/user-profile";
import { getDashboardPath } from "@/utils/auth-navigation";
import { scheduleConsolePrefetch } from "@/utils/console-prefetch";
import { cn } from "@/utils/utils";

const LANDING_HEADER_CHIP =
  "rounded-md border border-border bg-transparent";
const LANDING_LIGHT_PAGE_BG = "bg-[#f7f5f1]";
const LANDING_LIGHT_HEADER_BG = "bg-[#f7f5f1]/80";
const LANDING_NAV_ITEM =
  "inline-flex h-full items-center bg-transparent px-3.5 font-mono text-xs uppercase text-foreground transition-colors hover:bg-transparent hover:text-foreground";

const GITHUB_REPO_URL = "https://github.com/tukeceshi/z3cz";

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
  const [headerScrolled, setHeaderScrolled] = useState(false);

  const dashboardPath = isAuthenticated && user ? getDashboardPath(user) : null;

  useEffect(() => {
    scheduleConsolePrefetch();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setHeaderScrolled(window.scrollY > 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const githubLink = (className: string) => (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className, "gap-1.5")}
    >
      <Github className="h-3.5 w-3.5" />
      GitHub
    </a>
  );

  const desktopNavLinks = (
    <>
      <button
        type="button"
        className={cn(LANDING_NAV_ITEM, "border-r border-border")}
        onClick={() => scrollToId("canvas")}
      >
        {t("landing.navFeatures")}
      </button>
      <button
        type="button"
        className={cn(LANDING_NAV_ITEM, "border-r border-border")}
        onClick={() => scrollToId("pricing")}
      >
        {t("landing.navPricing")}
      </button>
      {githubLink(LANDING_NAV_ITEM)}
    </>
  );

  const mobileNavLinks = (
    <>
      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-foreground"
        onClick={() => {
          scrollToId("canvas");
          setMenuOpen(false);
        }}
      >
        {t("landing.navFeatures")}
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
      {githubLink("inline-flex items-center text-sm text-muted-foreground hover:text-foreground")}
    </>
  );

  return (
    <div
      className={cn(
        "landing-page-scroll min-h-svh text-foreground dark:bg-neutral-900",
        LANDING_LIGHT_PAGE_BG,
      )}
    >
      <header
        className={cn(
          "sticky top-0 z-40 py-4 backdrop-blur transition-[border-color] duration-300 dark:bg-neutral-900/80",
          LANDING_LIGHT_HEADER_BG,
          headerScrolled && "border-b border-border",
        )}
      >
        <div className="mx-auto max-w-[94rem] px-6 lg:px-12">
          <div className="flex items-center justify-between gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-4">
            <a
              href="#intro"
              className="flex min-w-0 items-center gap-2 justify-self-start"
            >
              <img
                src="/icon.svg"
                alt=""
                className="h-8 w-8 shrink-0 dark:invert"
              />
              <span className="truncate text-lg font-bold">
                {siteSettings.siteName}
              </span>
            </a>
            <nav
              className={cn(
                "hidden h-[42px] items-stretch overflow-hidden lg:flex justify-self-center",
                LANDING_HEADER_CHIP,
              )}
            >
              {desktopNavLinks}
            </nav>
            <div className="flex items-center gap-1 sm:gap-2 justify-self-end">
              <LanguageToggle
                variant="landing"
                className={cn(
                  "h-8 text-foreground/80 bg-transparent hover:bg-transparent",
                  LANDING_HEADER_CHIP,
                )}
              />
              <ThemeToggle
                variant="landing"
                className={cn(
                  "h-8 w-8 items-center justify-center rounded-md text-foreground bg-transparent hover:bg-transparent",
                  LANDING_HEADER_CHIP,
                )}
              />
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
                    className="lg:hidden"
                    aria-label={t("landing.menuOpen")}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64 dark:bg-neutral-900">
                  <SheetHeader>
                    <SheetTitle>{siteSettings.siteName}</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 flex flex-col gap-4">{mobileNavLinks}</div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main>
        <LandingHeroSection />

        <LandingBillingSection />

        <LandingCanvasSection />

        <section className="py-4">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 md:flex-row md:items-center md:px-6">
            <h2 className="text-2xl font-semibold">{t("landing.ctaTitle")}</h2>
            {dashboardPath ? (
              <Button asChild>
                <Link to={dashboardPath}>{t("landing.enterConsole")}</Link>
              </Button>
            ) : (
              <Button onClick={handleLogin}>
                {t("landing.loginRegister")}
              </Button>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e2ded4] py-8 dark:border-neutral-800">
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
