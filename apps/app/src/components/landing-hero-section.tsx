import ArrowRight from "lucide-react/icons/arrow-right";
import Check from "lucide-react/icons/check";

import { LandingHeroFeaturedPricing } from "@/components/landing-hero-featured-pricing";
import { useTranslation } from "@/components/locale-provider";
import { cn } from "@/utils/utils";

const LANDING_BORDER = "border-[#e2ded4]";
const REAPI_BRAND = "text-[#5b66de]";
const HERO_BRAND_CLASS =
  "landing-hero-brand inline-flex items-end font-mono font-bold leading-none lining-nums text-[#5b66de]";

const HERO_FEATURE_KEYS = [
  "landing.heroFeatureCanvas",
  "landing.heroFeatureView",
  "landing.heroFeatureApi",
  "landing.heroFeatureStorage",
  "landing.heroFeatureCollab",
] as const;

function HeroFeatureList(props: { readonly features: readonly string[] }) {
  return (
    <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 font-mono text-xs uppercase text-muted-foreground">
      {props.features.map((feature, index) => (
        <li key={feature} className="flex items-center gap-2.5">
          {index > 0 ? (
            <span
              aria-hidden
              className="hidden size-1 bg-foreground/25 sm:block"
            />
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <Check
              className={cn("size-3.5 shrink-0", REAPI_BRAND)}
              strokeWidth={3}
            />
            {feature}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function LandingHeroSection() {
  const { t } = useTranslation();
  const features = HERO_FEATURE_KEYS.map((key) => t(key));

  return (
    <section
      id="intro"
      className={cn(
        "relative isolate flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden text-foreground dark:bg-neutral-900",
        LANDING_BORDER,
        "border-b bg-[#f7f5f1]",
      )}
    >
      <div
        aria-hidden
        className="landing-glow-hero-top pointer-events-none absolute inset-0 -z-10"
      />
      <div className="relative z-0 flex flex-1 items-center pt-8 sm:pt-10">
        <div className="mx-auto w-full max-w-[94rem] px-6 lg:px-12">
          <div className="mx-auto max-w-6xl text-center">
            <h1
              className="mx-auto max-w-5xl font-serif text-balance font-bold leading-[1.4] tracking-[-0.035em] text-foreground"
              style={{ fontSize: "clamp(1.75rem, 3.4vw, 2.875rem)" }}
            >
              <span className={HERO_BRAND_CLASS}>z3cz</span>:{t("landing.heroHeadlineSuffix")}
            </h1>

            <p className="mx-auto mt-6 max-w-3xl font-mono text-[17px] leading-relaxed tracking-[-0.02em] text-pretty text-muted-foreground">
              {t("landing.heroDescription")}
            </p>
            <HeroFeatureList features={features} />

            <div className="mt-12 flex justify-center">
              <button
                type="button"
                className="inline-flex h-11 items-center gap-3 rounded-md bg-[#5b66de] px-8 font-mono text-xs uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#4a55cf]"
                onClick={() => {
                  document
                    .getElementById("landing-canvas-demo")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <span aria-hidden className="size-1.5 bg-white/80" />
                {t("landing.heroDemoCta")}
                <ArrowRight className="size-3.5" />
              </button>
            </div>

            <LandingHeroFeaturedPricing />
          </div>
        </div>
      </div>
    </section>
  );
}
