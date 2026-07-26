import type { AppLocale } from "@dafthunk/types";
import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

function getDateFnsLocale(locale?: AppLocale) {
  return locale === "zh" ? zhCN : enUS;
}

export function formatDate(date: string | Date): string {
  try {
    return format(new Date(date), "MMM d, yyyy h:mm a");
  } catch {
    return String(date);
  }
}

export function formatRelativeDate(
  date: string | Date,
  locale?: AppLocale
): string {
  try {
    return formatDistanceToNowStrict(new Date(date), {
      addSuffix: true,
      locale: getDateFnsLocale(locale),
    });
  } catch {
    return String(date);
  }
}
