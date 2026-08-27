import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

export const MODEL_INVOCATIONS_PAGE_SIZE = 20;

export interface AppliedDateParams {
  readonly dateFrom?: string;
  readonly dateTo?: string;
}

export function formatDateRangeLabel(
  range: DateRange | undefined,
  allDatesLabel: string
): string {
  if (!range?.from) {
    return allDatesLabel;
  }

  const fromLabel = format(range.from, "yyyy-MM-dd");
  if (!range.to) {
    return fromLabel;
  }

  const toLabel = format(range.to, "yyyy-MM-dd");
  if (toLabel === fromLabel) {
    return fromLabel;
  }

  return `${fromLabel} ~ ${toLabel}`;
}

export function toAppliedDateParams(
  range: DateRange | undefined
): AppliedDateParams {
  if (!range?.from) {
    return {};
  }

  const dateFrom = format(range.from, "yyyy-MM-dd");
  const endDate = range.to ?? range.from;
  const dateTo = format(endDate, "yyyy-MM-dd");
  return { dateFrom, dateTo };
}

export function hasAppliedDateFilter(params: AppliedDateParams): boolean {
  return params.dateFrom !== undefined || params.dateTo !== undefined;
}
