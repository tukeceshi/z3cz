import { useEffect, useState } from "react";

import { useTheme } from "@/components/theme-provider";

function readResolvedThemeMode(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useResolvedThemeMode(): "light" | "dark" {
  const { theme } = useTheme();
  const [resolved, setResolved] = useState<"light" | "dark">(readResolvedThemeMode);

  useEffect(() => {
    const update = () => {
      setResolved(readResolvedThemeMode());
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", update);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", update);
    };
  }, [theme]);

  return resolved;
}
