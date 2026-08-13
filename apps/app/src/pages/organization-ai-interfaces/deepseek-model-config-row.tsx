import type { OrgTextModelOption } from "@dafthunk/types";
import { Settings } from "lucide-react";

import { CredentialPlainInput } from "@/components/credential-secret-input";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

import { ModelBrandIcon } from "./model-brand-icon";
import { resolveDeepSeekModelCardName } from "./single-model-display-name";

export interface ProviderModelConfigOption {
  readonly canonicalId: string;
  readonly displayName: string;
}

interface DeepSeekModelConfigRowProps {
  readonly model: ProviderModelConfigOption;

  readonly checked: boolean;

  readonly modelId: string | undefined;

  readonly modelIdLabel: string;

  readonly onCheckedChange: (checked: boolean) => void;

  readonly onModelIdChange: (value: string) => void;

  readonly showCapabilitySettings?: boolean;

  readonly onOpenCapabilitySettings?: () => void;

  readonly capabilitySettingsLabel?: string;
}



const MODEL_CONFIG_GRID =
  "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)_auto] sm:items-center sm:gap-3";

const MODEL_CONFIG_GRID_WITHOUT_ACTIONS =
  "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center sm:gap-3";

export function DeepSeekModelConfigRow({
  model,
  checked,
  modelId,
  modelIdLabel,
  onCheckedChange,
  onModelIdChange,
  showCapabilitySettings = false,
  onOpenCapabilitySettings,
  capabilitySettingsLabel,
}: DeepSeekModelConfigRowProps) {
  const modelIdInputId = `single-model-id-${model.canonicalId}`;
  const gridClass = showCapabilitySettings
    ? MODEL_CONFIG_GRID
    : MODEL_CONFIG_GRID_WITHOUT_ACTIONS;

  return (
    <div
      className={cn(
        "px-3 py-2.5 transition-colors",
        gridClass,
        checked ? "bg-primary/5" : "bg-muted/20 opacity-80"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          className="size-4 shrink-0 rounded border border-input accent-primary"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-label={resolveDeepSeekModelCardName(
            model.canonicalId,
            model.displayName
          )}
        />
        <ModelBrandIcon canonicalId={model.canonicalId} />
        <span className="truncate text-sm font-medium">
          {resolveDeepSeekModelCardName(
            model.canonicalId,
            model.displayName
          )}
        </span>
      </div>

      <div
        className="min-w-0 pl-6 sm:pl-0"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {checked && modelId !== undefined ? (
          <CredentialPlainInput
            id={modelIdInputId}
            name={`single_model_id_${model.canonicalId}`}
            aria-label={`${model.displayName} ${modelIdLabel}`}
            className="h-9 w-full font-mono text-xs"
            value={modelId}
            onChange={(event) => onModelIdChange(event.target.value)}
          />
        ) : (
          <span className="text-muted-foreground block px-3 text-sm">—</span>
        )}
      </div>

      {showCapabilitySettings ? (
        <div className="flex justify-end pl-6 sm:pl-0">
          {checked && onOpenCapabilitySettings ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={onOpenCapabilitySettings}
              aria-label={capabilitySettingsLabel}
            >
              <Settings className="size-4" />
            </Button>
          ) : (
            <span className="text-muted-foreground block size-8" />
          )}
        </div>
      ) : null}
    </div>
  );
}



interface DeepSeekModelIdEditRowProps {

  readonly canonicalId: string;

  readonly label: string;

  readonly modelId: string;

  readonly modelIdLabel: string;

  readonly onModelIdChange: (value: string) => void;

  readonly showCapabilitySettings?: boolean;

  readonly onOpenCapabilitySettings?: () => void;

  readonly capabilitySettingsLabel?: string;

  readonly isVideoModel?: boolean;

}



export function DeepSeekModelIdEditRow({

  canonicalId,

  label,

  modelId,

  modelIdLabel,

  onModelIdChange,

  showCapabilitySettings = false,

  onOpenCapabilitySettings,

  capabilitySettingsLabel,

  isVideoModel = false,

}: DeepSeekModelIdEditRowProps) {

  const modelIdInputId = `single-model-edit-id-${canonicalId}`;
  const gridClass = showCapabilitySettings
    ? MODEL_CONFIG_GRID
    : MODEL_CONFIG_GRID_WITHOUT_ACTIONS;



  return (
    <div className={cn("px-3 py-2.5", gridClass)}>
      <div className="flex min-w-0 items-center gap-2">
        <ModelBrandIcon canonicalId={canonicalId} />
        <span className="truncate text-sm font-medium">{label}</span>
      </div>

      <div className="min-w-0 pl-6 sm:pl-0">
        <CredentialPlainInput
          id={modelIdInputId}
          name={`single_model_edit_id_${canonicalId}`}
          aria-label={`${label} ${modelIdLabel}`}
          className="h-9 w-full font-mono text-xs"
          value={modelId}
          onChange={(event) => onModelIdChange(event.target.value)}
        />
      </div>

      {showCapabilitySettings && isVideoModel ? (
        <div className="flex justify-end pl-6 sm:pl-0">
          {onOpenCapabilitySettings ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={onOpenCapabilitySettings}
              aria-label={capabilitySettingsLabel}
            >
              <Settings className="size-4" />
            </Button>
          ) : (
            <span className="text-muted-foreground block size-8" />
          )}
        </div>
      ) : showCapabilitySettings ? (
        <span className="text-muted-foreground block size-8" />
      ) : null}
    </div>
  );
}



interface DeepSeekModelIdEditListProps {

  readonly rows: readonly {

    readonly canonicalId: string;

    readonly label: string;

    readonly modelId: string;

  }[];

  readonly modelColumnLabel: string;

  readonly modelIdLabel: string;

  readonly onModelIdChange: (canonicalId: string, value: string) => void;

  readonly showCapabilitySettings?: boolean;

  readonly videoCanonicalIds?: ReadonlySet<string>;

  readonly onOpenCapabilitySettings?: (canonicalId: string) => void;

  readonly capabilitySettingsLabel?: string;

}



export function DeepSeekModelIdEditList({

  rows,

  modelColumnLabel,

  modelIdLabel,

  onModelIdChange,

  showCapabilitySettings = false,

  videoCanonicalIds,

  onOpenCapabilitySettings,

  capabilitySettingsLabel,

}: DeepSeekModelIdEditListProps) {

  const headerGridClass = showCapabilitySettings
    ? MODEL_CONFIG_GRID
    : MODEL_CONFIG_GRID_WITHOUT_ACTIONS;

  return (

    <div className="overflow-hidden rounded-lg border">

      <div
        className={cn(
          "text-muted-foreground border-b bg-muted/40 px-3 py-2 text-xs font-medium",
          headerGridClass
        )}
      >
        <span>{modelColumnLabel}</span>
        <span className="pl-6 sm:pl-0">{modelIdLabel}</span>
        {showCapabilitySettings ? <span className="sr-only">{capabilitySettingsLabel}</span> : null}
      </div>

      <div className="divide-y">
        {rows.map((row) => (

          <DeepSeekModelIdEditRow

            key={row.canonicalId}

            canonicalId={row.canonicalId}

            label={row.label}

            modelId={row.modelId}

            modelIdLabel={modelIdLabel}

            onModelIdChange={(value) => onModelIdChange(row.canonicalId, value)}

            showCapabilitySettings={showCapabilitySettings}

            isVideoModel={videoCanonicalIds?.has(row.canonicalId) ?? false}

            onOpenCapabilitySettings={
              onOpenCapabilitySettings
                ? () => onOpenCapabilitySettings(row.canonicalId)
                : undefined
            }

            capabilitySettingsLabel={capabilitySettingsLabel}

          />

        ))}

      </div>

    </div>

  );

}



interface DeepSeekModelConfigListProps {
  readonly models: readonly ProviderModelConfigOption[];

  readonly checkedCanonicalIds: readonly string[];

  readonly draftsByCanonicalId: Readonly<

    Map<string, { readonly modelId: string }>

  >;

  readonly modelColumnLabel: string;

  readonly modelIdLabel: string;

  readonly onCheckedChange: (canonicalId: string, checked: boolean) => void;

  readonly onModelIdChange: (canonicalId: string, value: string) => void;

  readonly showCapabilitySettings?: boolean;

  readonly videoCanonicalIds?: ReadonlySet<string>;

  readonly onOpenCapabilitySettings?: (canonicalId: string) => void;

  readonly capabilitySettingsLabel?: string;

}



export function DeepSeekModelConfigList({

  models,

  checkedCanonicalIds,

  draftsByCanonicalId,

  modelColumnLabel,

  modelIdLabel,

  onCheckedChange,

  onModelIdChange,

  showCapabilitySettings = false,

  videoCanonicalIds,

  onOpenCapabilitySettings,

  capabilitySettingsLabel,

}: DeepSeekModelConfigListProps) {
  const headerGridClass = showCapabilitySettings
    ? MODEL_CONFIG_GRID
    : MODEL_CONFIG_GRID_WITHOUT_ACTIONS;

  return (

    <div className="overflow-hidden rounded-lg border">

      <div
        className={cn(
          "text-muted-foreground border-b bg-muted/40 px-3 py-2 text-xs font-medium",
          headerGridClass
        )}
      >
        <span>{modelColumnLabel}</span>
        <span className="pl-6 sm:pl-0">{modelIdLabel}</span>
        {showCapabilitySettings ? <span className="sr-only">{capabilitySettingsLabel}</span> : null}
      </div>

      <div className="divide-y">
        {models.map((model) => {

          const checked = checkedCanonicalIds.includes(model.canonicalId);

          const draft = draftsByCanonicalId.get(model.canonicalId);

          return (

            <DeepSeekModelConfigRow

              key={model.canonicalId}

              model={model}

              checked={checked}

              modelId={checked ? (draft?.modelId ?? "") : undefined}

              modelIdLabel={modelIdLabel}

              onCheckedChange={(nextChecked) =>

                onCheckedChange(model.canonicalId, nextChecked)

              }

              onModelIdChange={(value) =>

                onModelIdChange(model.canonicalId, value)

              }

              showCapabilitySettings={
                showCapabilitySettings &&
                (videoCanonicalIds?.has(model.canonicalId) ?? false)
              }

              onOpenCapabilitySettings={
                onOpenCapabilitySettings
                  ? () => onOpenCapabilitySettings(model.canonicalId)
                  : undefined
              }

              capabilitySettingsLabel={capabilitySettingsLabel}

            />

          );

        })}

      </div>

    </div>

  );

}

