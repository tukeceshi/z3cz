import Languages from "lucide-react/icons/languages";

import { useTranslation } from "@/components/locale-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppLocale } from "@dafthunk/types";

const LOCALE_OPTIONS: readonly AppLocale[] = ["en", "zh"];

export function LanguageToggle() {
  const { locale, setLocale, t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 transition-colors"
          aria-label={t("language.toggle")}
        >
          <Languages className="h-4 w-4" />
          <span className="uppercase text-xs font-medium">
            {locale === "zh" ? "中" : "EN"}
          </span>
        </button>
      </DropdownMenuTrigger>
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
