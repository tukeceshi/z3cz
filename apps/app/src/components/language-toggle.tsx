import Languages from "lucide-react/icons/languages";



import {

  LandingDropdownMenu,

  LandingDropdownMenuItem,

} from "@/components/landing-select-menu";

import { useTranslation } from "@/components/locale-provider";

import {

  DropdownMenu,

  DropdownMenuContent,

  DropdownMenuItem,

  DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu";

import { cn } from "@/utils/utils";

import type { AppLocale } from "@dafthunk/types";



const LOCALE_OPTIONS: readonly AppLocale[] = ["en", "zh"];



interface LanguageToggleProps {

  readonly className?: string;

  readonly variant?: "default" | "landing";

}



export function LanguageToggle({

  className,

  variant = "default",

}: LanguageToggleProps) {

  const { locale, setLocale, t } = useTranslation();



  const trigger = (

    <button

      type="button"

      className={cn(

        "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors",

        className,

      )}

      aria-label={t("language.toggle")}

    >

      <Languages className="h-4 w-4" />

      <span className="uppercase text-xs font-medium">

        {locale === "zh" ? "中" : "EN"}

      </span>

    </button>

  );



  if (variant === "landing") {

    return (

      <LandingDropdownMenu trigger={trigger}>

        {LOCALE_OPTIONS.map((option) => (

          <LandingDropdownMenuItem

            key={option}

            active={locale === option}

            onSelect={() => setLocale(option)}

          >

            {option === "en" ? t("language.en") : t("language.zh")}

          </LandingDropdownMenuItem>

        ))}

      </LandingDropdownMenu>

    );

  }



  return (

    <DropdownMenu>

      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

      <DropdownMenuContent align="end">

        {LOCALE_OPTIONS.map((option) => (

          <DropdownMenuItem

            key={option}

            onClick={() => setLocale(option)}

            className={locale === option ? "font-medium" : undefined}

          >

            {option === "en" ? t("language.en") : t("language.zh")}

          </DropdownMenuItem>

        ))}

      </DropdownMenuContent>

    </DropdownMenu>

  );

}


