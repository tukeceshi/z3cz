import ChevronDownIcon from "lucide-react/icons/chevron-down";

import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/utils/utils";

import { LIST_SCROLL_CLASS } from "@/components/list-scroll";

import {
  GROUP_ICON_OPTIONS,
  ModelBrandIcon,
  type GroupIconOption,
} from "./model-brand-icon";

export const DEFAULT_BRAND_ICON: GroupIconOption = "sparkles";

export function formatBrandIconLabel(
  icon: string,
  labels: { readonly defaultLabel: string; readonly doubaoLabel: string }
): string {
  if (icon === "sparkles") {
    return labels.defaultLabel;
  }
  if (icon === "doubao") {
    return labels.doubaoLabel;
  }
  return icon;
}

export function ModelBrandIconPicker({
  value,
  onChange,
  disabled = false,
  label,
  controlClassName,
  popoverWidthClassName,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly label?: string;
  readonly controlClassName?: string;
  readonly popoverWidthClassName?: string;
}) {
  const { t } = useTranslation();
  const labels = {
    defaultLabel: t("pages.adminAiModels.groupIconDefault"),
    doubaoLabel: t("pages.adminAiModels.groupIconDoubao"),
  };

  return (
    <div className="space-y-1.5">
      {label ? <Label className="text-[11px] text-muted-foreground">{label}</Label> : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-9 w-full justify-start gap-2 px-2",
              controlClassName
            )}
          >
            <ModelBrandIcon icon={value} className="size-5" />
            <span className="truncate text-xs">
              {formatBrandIconLabel(value, labels)}
            </span>
            <ChevronDownIcon className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(
            LIST_SCROLL_CLASS,
            "max-h-64 p-2 pr-3",
            popoverWidthClassName ?? "w-56"
          )}
        >
          <div className="grid gap-0.5">
            {GROUP_ICON_OPTIONS.map((option) => (
              <BrandIconOptionRow
                key={option}
                icon={option}
                label={formatBrandIconLabel(option, labels)}
                selected={value === option}
                onSelect={() => onChange(option)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function BrandIconOptionRow({
  icon,
  label,
  selected,
  onSelect,
}: {
  readonly icon: string;
  readonly label: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
        selected
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
      onClick={onSelect}
    >
      <ModelBrandIcon icon={icon} className="size-4" />
      <span className="truncate">{label}</span>
    </button>
  );
}
