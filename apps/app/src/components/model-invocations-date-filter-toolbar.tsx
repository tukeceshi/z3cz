import CalendarIcon from "lucide-react/icons/calendar";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateRangeLabel } from "@/utils/model-invocations-date-filter";
import { cn } from "@/utils/utils";

interface ModelInvocationsDateFilterToolbarProps {
  draftRange: DateRange | undefined;
  onDraftRangeChange: (range: DateRange | undefined) => void;
  onSearch: () => void;
  onClear: () => void;
  allDatesLabel: string;
  searchLabel: string;
  clearFilterLabel: string;
}

export function ModelInvocationsDateFilterToolbar({
  draftRange,
  onDraftRangeChange,
  onSearch,
  onClear,
  allDatesLabel,
  searchLabel,
  clearFilterLabel,
}: ModelInvocationsDateFilterToolbarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "min-w-40 justify-start text-left font-normal",
              !draftRange?.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            {formatDateRangeLabel(draftRange, allDatesLabel)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={draftRange}
            onSelect={onDraftRangeChange}
          />
        </PopoverContent>
      </Popover>

      <Button size="sm" onClick={onSearch}>
        {searchLabel}
      </Button>
      <Button size="sm" variant="outline" onClick={onClear}>
        {clearFilterLabel}
      </Button>
    </div>
  );
}
