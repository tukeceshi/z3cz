import Moon from "lucide-react/icons/moon";

import Sun from "lucide-react/icons/sun";



import {

  LandingDropdownMenu,

  LandingDropdownMenuItem,

} from "@/components/landing-select-menu";

import { useTranslation } from "@/components/locale-provider";

import { useTheme } from "@/components/theme-provider";

import {

  DropdownMenu,

  DropdownMenuContent,

  DropdownMenuItem,

  DropdownMenuTrigger,

} from "@/components/ui/dropdown-menu";

import { cn } from "@/utils/utils";



interface ThemeToggleProps {

  readonly className?: string;

  readonly variant?: "default" | "landing";

}



export function ThemeToggle({

  className,

  variant = "default",

}: ThemeToggleProps) {

  const { theme, setTheme } = useTheme();

  const { t } = useTranslation();



  const trigger = (

    <button

      type="button"

      data-tour="theme-toggle"

      className={cn(

        "inline-flex p-1.5 relative rounded-full overflow-hidden",

        className,

      )}

      aria-label={t("theme.toggle")}

    >

      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />

      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />

      <span className="sr-only">{t("theme.toggle")}</span>

    </button>

  );



  const options = [

    { id: "light" as const, label: t("theme.light") },

    { id: "dark" as const, label: t("theme.dark") },

    { id: "system" as const, label: t("theme.system") },

  ];



  if (variant === "landing") {

    return (

      <LandingDropdownMenu trigger={trigger}>

        {options.map((option) => (

          <LandingDropdownMenuItem

            key={option.id}

            active={theme === option.id}

            onSelect={() => setTheme(option.id)}

          >

            {option.label}

          </LandingDropdownMenuItem>

        ))}

      </LandingDropdownMenu>

    );

  }



  return (

    <DropdownMenu>

      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

      <DropdownMenuContent align="end">

        {options.map((option) => (

          <DropdownMenuItem key={option.id} onClick={() => setTheme(option.id)}>

            {option.label}

          </DropdownMenuItem>

        ))}

      </DropdownMenuContent>

    </DropdownMenu>

  );

}


