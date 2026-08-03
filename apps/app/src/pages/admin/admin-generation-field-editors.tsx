import {
  buildGenerateCountOptions,
  DEFAULT_IMAGE_GENERATION_FIELDS,
  DEFAULT_VIDEO_GENERATION_FIELDS,
  formatImageGenerationOptionLabel,
  IMAGE_GENERATION_FIELD_CATALOG,
  type GenerationCountEffectMode,
  type GenerationCountPolicy,
  type GenerationSizeEffectMode,
  type UpstreamParamProfileField,
  normalizeGenerationCountEffectMode,
} from "@dafthunk/types";

import { useTranslation } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/utils/utils";

import {
  ADMIN_CONTROL_CLASS,
  ADMIN_PARAM_API_NAME_CLASS,
  ADMIN_PARAM_HINT_CLASS,
  ADMIN_PARAM_LABEL_CLASS,
  ADMIN_SETTINGS_GRID_CLASS,
  AdminFieldRow,
  SettingsSection,
  useAdminParamApiNameAddon,
} from "./admin-ai-models-ui";

const PARAMETER_BLOCK_CLASS =
  "rounded-lg border border-border/60 bg-background p-3 space-y-3";
export const ADMIN_ENUM_CHIP_CLASS = cn(
  "inline-flex h-7 min-w-10 items-center justify-center rounded-md border px-2 text-[11px] transition-colors",
  "border-border/60 bg-background hover:bg-muted/50"
);

function adminGenerationOptionChipClass({
  enabled,
  isDefault,
}: {
  readonly enabled: boolean;
  readonly isDefault: boolean;
}): string {
  return cn(
    ADMIN_ENUM_CHIP_CLASS,
    enabled
      ? "border-primary/40 bg-primary/5 text-foreground"
      : "border-dashed text-muted-foreground",
    enabled && isDefault && "border-primary ring-1 ring-primary/30"
  );
}

function AdminGenerationOptionChip({
  label,
  enabled,
  isDefault,
  onClick,
}: {
  readonly label: string;
  readonly enabled: boolean;
  readonly isDefault: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={adminGenerationOptionChipClass({ enabled, isDefault })}
    >
      <span>{label}</span>
      {enabled ? (
        <span className={cn("ml-1", ADMIN_PARAM_HINT_CLASS)}>✓</span>
      ) : null}
    </button>
  );
}

const SIZE_POLICY_FIELD_NAMES = new Set(["size", "ratio"]);
const COUNT_FIELD_NAMES = new Set(["generate_count"]);

function imageGenerationFieldCatalog(): readonly UpstreamParamProfileField[] {
  return IMAGE_GENERATION_FIELD_CATALOG;
}

function normalizeSizeEffectMode(
  effectMode: GenerationSizeEffectMode
): "ratio_prompt" | "pixel_size" {
  if (effectMode === "legacy" || effectMode === "k_only") {
    return "ratio_prompt";
  }
  if (effectMode === "pixel_size") {
    return "pixel_size";
  }
  return "ratio_prompt";
}

export interface GenerationOptionLabels {
  readonly smartOption: string;
  readonly size1K: string;
  readonly size2K: string;
  readonly size4K: string;
  readonly optimizePromptStandard: string;
  readonly optimizePromptFast: string;
}

function formatAdminGenerationOptionLabel(
  fieldName: string,
  option: string,
  labels: GenerationOptionLabels
): string {
  const smart = formatImageGenerationOptionLabel(fieldName, option, labels.smartOption, {
    optimizePromptStandard: labels.optimizePromptStandard,
    optimizePromptFast: labels.optimizePromptFast,
  });
  if (smart !== option) {
    return smart;
  }
  if (fieldName === "size" || fieldName === "resolution") {
    const key = option.toUpperCase();
    if (key === "1K") return labels.size1K;
    if (key === "2K") return labels.size2K;
    if (key === "4K") return labels.size4K;
  }
  return option;
}

function catalogEnumOptions(
  field: UpstreamParamProfileField,
  modality: "image" | "video"
): readonly string[] {
  const catalog =
    modality === "image"
      ? imageGenerationFieldCatalog()
      : DEFAULT_VIDEO_GENERATION_FIELDS;
  const catalogValues =
    catalog.find((entry) => entry.name === field.name)?.enumValues ?? [];
  const current = field.enumValues ?? [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const option of [...catalogValues, ...current]) {
    if (seen.has(option)) continue;
    seen.add(option);
    ordered.push(option);
  }
  return ordered;
}

function orderEnabledEnumValues(
  field: UpstreamParamProfileField,
  enabledValues: readonly string[],
  modality: "image" | "video"
): string[] {
  const enabled = new Set(enabledValues);
  return catalogEnumOptions(field, modality).filter((option) =>
    enabled.has(option)
  );
}

export function GenerationEnumChips({
  field,
  modality,
  optionLabels,
  onChange,
}: {
  readonly field: UpstreamParamProfileField;
  readonly modality: "image" | "video";
  readonly optionLabels: GenerationOptionLabels;
  readonly onChange: (next: UpstreamParamProfileField) => void;
}) {
  const options = catalogEnumOptions(field, modality);
  const enabled = new Set(field.enumValues ?? []);
  const defaultValue =
    field.default === undefined ? "" : String(field.default);

  const handleClick = (option: string) => {
    const isEnabled = enabled.has(option);
    const isDefault = defaultValue === option;

    if (!isEnabled) {
      onChange({
        ...field,
        enumValues: orderEnabledEnumValues(
          field,
          [...(field.enumValues ?? []), option],
          modality
        ),
        default:
          field.type === "number"
            ? Number(option)
            : (field.default === undefined ? option : field.default),
      });
      return;
    }

    if (!isDefault) {
      onChange({
        ...field,
        default: field.type === "number" ? Number(option) : option,
      });
      return;
    }

    if ((field.enumValues?.length ?? 0) <= 1) {
      return;
    }

    const nextEnabled = orderEnabledEnumValues(
      field,
      (field.enumValues ?? []).filter((value) => value !== option),
      modality
    );
    const nextDefault = nextEnabled[0]!;
    onChange({
      ...field,
      enumValues: nextEnabled,
      default: field.type === "number" ? Number(nextDefault) : nextDefault,
    });
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const isEnabled = enabled.has(option);
        const isDefault = isEnabled && defaultValue === option;
        const label = formatAdminGenerationOptionLabel(
          field.name,
          option,
          optionLabels
        );
        return (
          <AdminGenerationOptionChip
            key={option}
            label={label}
            enabled={isEnabled}
            isDefault={isDefault}
            onClick={() => handleClick(option)}
          />
        );
      })}
    </div>
  );
}

export function SizePolicyEditor({
  policy,
  fields,
  optionLabels,
  onChange,
  onFieldsChange,
}: {
  readonly policy: { enabled: boolean; effectMode: GenerationSizeEffectMode };
  readonly fields: readonly UpstreamParamProfileField[];
  readonly optionLabels: GenerationOptionLabels;
  readonly onChange: (policy: {
    enabled: boolean;
    effectMode: GenerationSizeEffectMode;
  }) => void;
  readonly onFieldsChange: (fields: UpstreamParamProfileField[]) => void;
}) {
  const { t } = useTranslation();
  const sizeField = fields.find((field) => field.name === "size");
  const ratioField = fields.find((field) => field.name === "ratio");
  const mode = normalizeSizeEffectMode(policy.effectMode);

  if (!policy.enabled) {
    return null;
  }

  return (
    <div className={ADMIN_SETTINGS_GRID_CLASS}>
        <div className="space-y-1.5">
          <Label className={ADMIN_PARAM_LABEL_CLASS}>
            {t("pages.adminAiModels.implementationModeLabel")}
          </Label>
          <Select
            value={mode}
            onValueChange={(value) =>
              onChange({
                ...policy,
                enabled: true,
                effectMode: value as GenerationSizeEffectMode,
              })
            }
          >
            <SelectTrigger className={ADMIN_CONTROL_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ratio_prompt">
                {t("pages.adminAiModels.sizeEffectModeRatioPrompt")}
              </SelectItem>
              <SelectItem value="pixel_size">
                {t("pages.adminAiModels.sizeEffectModePixelSize")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {sizeField ? (
          <div className="col-span-full space-y-1.5">
            <Label className={ADMIN_PARAM_LABEL_CLASS}>
              {t("pages.adminAiModels.sizeResolutionLabel")}
            </Label>
            <GenerationEnumChips
              field={sizeField}
              modality="image"
              optionLabels={optionLabels}
              onChange={(next) =>
                onFieldsChange(
                  fields.map((field) =>
                    field.name === "size" ? next : field
                  )
                )
              }
            />
          </div>
        ) : null}
        {ratioField ? (
          <div className="col-span-full space-y-1.5">
            <Label className={ADMIN_PARAM_LABEL_CLASS}>
              {t("pages.adminAiModels.sizeRatioLabel")}
            </Label>
            <GenerationEnumChips
              field={ratioField}
              modality="image"
              optionLabels={optionLabels}
              onChange={(next) =>
                onFieldsChange(
                  fields.map((field) =>
                    field.name === "ratio" ? next : field
                  )
                )
              }
            />
          </div>
        ) : null}
    </div>
  );
}

const IMAGE_GENERATE_COUNT_MAX = 15;

function resolveMaxCountFromField(
  field: UpstreamParamProfileField
): number {
  const fromEnum = (field.enumValues ?? [])
    .map((value) => Number(value))
    .filter((count) => Number.isFinite(count) && count >= 1);
  if (fromEnum.length > 0) {
    return Math.min(IMAGE_GENERATE_COUNT_MAX, Math.max(...fromEnum));
  }
  return 4;
}

function resolveDefaultCountFromField(
  field: UpstreamParamProfileField
): number {
  const raw = field.default;
  const parsed = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(parsed) && parsed >= 1) {
    return Math.floor(parsed);
  }
  return 1;
}

export function ImageCountEditor({
  policy,
  fields,
  onPolicyChange,
  onFieldsChange,
}: {
  readonly policy: GenerationCountPolicy;
  readonly fields: readonly UpstreamParamProfileField[];
  readonly onPolicyChange: (policy: GenerationCountPolicy) => void;
  readonly onFieldsChange: (fields: UpstreamParamProfileField[]) => void;
}) {
  const { t } = useTranslation();
  const template = DEFAULT_IMAGE_GENERATION_FIELDS.find(
    (field) => field.name === "generate_count"
  );
  const countField = fields.find((field) => field.name === "generate_count");
  const working = countField ?? template;
  const effectMode = normalizeGenerationCountEffectMode(policy.effectMode);

  if (!working || !policy.enabled) {
    return null;
  }

  const maxCount = resolveMaxCountFromField(working);
  const defaultCount = Math.min(
    resolveDefaultCountFromField(working),
    maxCount
  );

  const setCountField = (next: UpstreamParamProfileField) => {
    if (countField) {
      onFieldsChange(
        fields.map((field) => (field.name === "generate_count" ? next : field))
      );
      return;
    }
    onFieldsChange([...fields, next]);
  };

  const handleMaxCountChange = (value: string) => {
    const nextMax = Math.min(
      IMAGE_GENERATE_COUNT_MAX,
      Math.max(1, Math.floor(Number(value)) || 1)
    );
    setCountField({
      ...working,
      enumValues: [...buildGenerateCountOptions(nextMax)],
      default: Math.min(defaultCount, nextMax),
    });
  };

  const handleDefaultCountChange = (value: string) => {
    const nextDefault = Math.min(
      maxCount,
      Math.max(1, Math.floor(Number(value)) || 1)
    );
    setCountField({
      ...working,
      default: nextDefault,
    });
  };

  return (
    <div className={ADMIN_SETTINGS_GRID_CLASS}>
      <div className="space-y-1.5">
        <Label className={ADMIN_PARAM_LABEL_CLASS}>
          {t("pages.adminAiModels.implementationModeLabel")}
        </Label>
        <Select
          value={effectMode}
          onValueChange={(value) =>
            onPolicyChange({
              ...policy,
              enabled: true,
              effectMode: value as GenerationCountEffectMode,
            })
          }
        >
          <SelectTrigger className={ADMIN_CONTROL_CLASS}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sequential_image_generation">
              {t("pages.adminAiModels.countEffectModeSeedreamSequential")}
            </SelectItem>
            <SelectItem value="direct">
              {t("pages.adminAiModels.countEffectModeDirect")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className={ADMIN_PARAM_LABEL_CLASS}>
          {t("pages.adminAiModels.countTotalLabel")}
        </Label>
        <Input
          type="number"
          min={1}
          max={IMAGE_GENERATE_COUNT_MAX}
          className={ADMIN_CONTROL_CLASS}
          value={maxCount}
          onChange={(event) => handleMaxCountChange(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className={ADMIN_PARAM_LABEL_CLASS}>
          {t("pages.adminAiModels.countDefaultLabel")}
        </Label>
        <Input
          type="number"
          min={1}
          max={maxCount}
          className={ADMIN_CONTROL_CLASS}
          value={defaultCount}
          onChange={(event) => handleDefaultCountChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function getGenerationFeatureRows(
  fields: readonly UpstreamParamProfileField[],
  modality: "image" | "video"
): readonly UpstreamParamProfileField[] {
  const catalog =
    modality === "image"
      ? imageGenerationFieldCatalog()
      : DEFAULT_VIDEO_GENERATION_FIELDS;
  const catalogVisible = catalog.filter((field) => {
    if (field.hidden) return false;
    if (modality === "image") {
      return (
        !SIZE_POLICY_FIELD_NAMES.has(field.name) &&
        !COUNT_FIELD_NAMES.has(field.name)
      );
    }
    return true;
  });
  const catalogNames = new Set(catalog.map((field) => field.name));
  const extraVisible = fields.filter(
    (field) =>
      !field.hidden &&
      !catalogNames.has(field.name) &&
      !SIZE_POLICY_FIELD_NAMES.has(field.name) &&
      !COUNT_FIELD_NAMES.has(field.name)
  );
  return [...catalogVisible, ...extraVisible];
}

function GenerationFeatureRowContent({
  template,
  active,
  catalog,
  modality,
  optionLabels,
  onFieldChange,
}: {
  readonly template: UpstreamParamProfileField;
  readonly active: UpstreamParamProfileField | undefined;
  readonly catalog: readonly UpstreamParamProfileField[];
  readonly modality: "image" | "video";
  readonly optionLabels: GenerationOptionLabels;
  readonly onFieldChange: (next: UpstreamParamProfileField) => void;
}) {
  const { t } = useTranslation();
  const enabled = Boolean(active && !active.hidden);
  const working = active && !active.hidden ? active : template;
  const showEnum =
    (working.enumValues?.length ?? 0) > 0 ||
    Boolean(
      catalog.find((entry) => entry.name === template.name)?.enumValues?.length
    );

  if (!enabled) {
    return null;
  }

  if (working.type === "boolean") {
    const defaultOn = working.default === true;

    return (
      <div className="flex items-center gap-3">
        <Label className={ADMIN_PARAM_LABEL_CLASS}>
          {t("pages.adminAiModels.defaultStateLabel")}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { value: true, label: t("admin.common.yes") },
              { value: false, label: t("admin.common.no") },
            ] as const
          ).map(({ value, label }) => (
            <AdminGenerationOptionChip
              key={String(value)}
              label={label}
              enabled={defaultOn === value}
              isDefault={defaultOn === value}
              onClick={() =>
                onFieldChange({
                  ...working,
                  default: value,
                })
              }
            />
          ))}
        </div>
      </div>
    );
  }

  if (showEnum) {
    return (
      <GenerationEnumChips
        field={{
          ...working,
          enumValues: working.enumValues ?? [],
        }}
        modality={modality}
        optionLabels={optionLabels}
        onChange={onFieldChange}
      />
    );
  }

  return (
    <div className={ADMIN_SETTINGS_GRID_CLASS}>
      <AdminFieldRow label={t("pages.adminAiModels.defaultValueLabel")}>
        <Input
          className={ADMIN_CONTROL_CLASS}
          type={working.type === "number" ? "number" : undefined}
          inputMode={working.type === "number" ? "numeric" : undefined}
          min={working.name === "output_compression" ? 0 : undefined}
          max={working.name === "output_compression" ? 100 : undefined}
          value={working.default === undefined ? "" : String(working.default)}
          onChange={(event) => {
            const raw = event.target.value;
            onFieldChange({
              ...working,
              default: working.type === "number" ? Number(raw) || 0 : raw,
            });
          }}
        />
      </AdminFieldRow>
    </div>
  );
}

function FlatFeatureParamSection({
  template,
  active,
  catalog,
  modality,
  optionLabels,
  enabled,
  onEnableChange,
  onFieldChange,
}: {
  readonly template: UpstreamParamProfileField;
  readonly active: UpstreamParamProfileField | undefined;
  readonly catalog: readonly UpstreamParamProfileField[];
  readonly modality: "image" | "video";
  readonly optionLabels: GenerationOptionLabels;
  readonly enabled: boolean;
  readonly onEnableChange: (enabled: boolean) => void;
  readonly onFieldChange: (next: UpstreamParamProfileField) => void;
}) {
  const working = active ?? template;
  const hasApiName = Boolean(working.apiName?.trim());
  const { titleAddon } = useAdminParamApiNameAddon(
    working.apiName ?? "",
    (next) => {
      if (!active) {
        return;
      }
      onFieldChange({ ...active, apiName: next });
    }
  );

  return (
    <SettingsSection
      compact
      stacked
      title={template.description || template.name}
      titleAddon={
        hasApiName ? (
          enabled ? (
            titleAddon
          ) : (
            <span className={ADMIN_PARAM_API_NAME_CLASS}>{working.apiName}</span>
          )
        ) : undefined
      }
      action={
        <Switch
          checked={enabled}
          onCheckedChange={onEnableChange}
        />
      }
    >
      <GenerationFeatureRowContent
        template={template}
        active={active}
        catalog={catalog}
        modality={modality}
        optionLabels={optionLabels}
        onFieldChange={onFieldChange}
      />
    </SettingsSection>
  );
}

export function GenerationFeaturesEditor({
  fields,
  modality,
  optionLabels,
  layout = "grouped",
  onChange,
}: {
  readonly fields: readonly UpstreamParamProfileField[];
  readonly modality: "image" | "video";
  readonly optionLabels: GenerationOptionLabels;
  readonly layout?: "grouped" | "flat";
  readonly onChange: (fields: UpstreamParamProfileField[]) => void;
}) {
  const catalog =
    modality === "image"
      ? imageGenerationFieldCatalog()
      : DEFAULT_VIDEO_GENERATION_FIELDS;
  const rows = getGenerationFeatureRows(fields, modality);
  const fieldByName = new Map(fields.map((field) => [field.name, field]));

  if (rows.length === 0) {
    return null;
  }

  const isCapabilityEnabled = (name: string): boolean => {
    const active = fieldByName.get(name);
    return Boolean(active && !active.hidden);
  };

  const setCapabilityEnabled = (
    template: UpstreamParamProfileField,
    enabled: boolean
  ) => {
    if (enabled) {
      onChange([
        ...fields.filter((field) => field.name !== template.name),
        { ...template },
      ]);
      return;
    }

    onChange(fields.filter((field) => field.name !== template.name));
  };

  const updateField = (name: string, next: UpstreamParamProfileField) => {
    onChange(fields.map((field) => (field.name === name ? next : field)));
  };

  if (layout === "flat") {
    return (
      <>
        {rows.map((template) => {
          const active = fieldByName.get(template.name);
          const enabled = isCapabilityEnabled(template.name);

          return (
            <FlatFeatureParamSection
              key={template.name}
              template={template}
              active={active}
              catalog={catalog}
              modality={modality}
              optionLabels={optionLabels}
              enabled={enabled}
              onEnableChange={(checked) =>
                setCapabilityEnabled(template, checked)
              }
              onFieldChange={(next) => updateField(template.name, next)}
            />
          );
        })}
      </>
    );
  }

  return (
    <div className={cn(PARAMETER_BLOCK_CLASS, "col-span-full space-y-3")}>
      {rows.map((template) => {
        const active = fieldByName.get(template.name);
        const enabled = isCapabilityEnabled(template.name);

        return (
          <div key={template.name} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className={ADMIN_PARAM_LABEL_CLASS}>
                {template.description || template.name}
              </Label>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) =>
                  setCapabilityEnabled(template, checked)
                }
              />
            </div>

            <GenerationFeatureRowContent
              template={template}
              active={active}
              catalog={catalog}
              modality={modality}
              optionLabels={optionLabels}
              onFieldChange={(next) => updateField(template.name, next)}
            />
          </div>
        );
      })}
    </div>
  );
}

export function useGenerationOptionLabels(): GenerationOptionLabels {
  const { t } = useTranslation();
  return {
    smartOption: t("workflow.aiImagePanel.smartOption"),
    size1K: t("workflow.aiImagePanel.sizeLabel1K"),
    size2K: t("workflow.aiImagePanel.sizeLabel2K"),
    size4K: t("workflow.aiImagePanel.sizeLabel4K"),
    optimizePromptStandard: t("workflow.aiImagePanel.optimizePromptStandard"),
    optimizePromptFast: t("workflow.aiImagePanel.optimizePromptFast"),
  };
}
