import type { OrgTextModelOption } from "@dafthunk/types";

import { CredentialPlainInput } from "@/components/credential-secret-input";
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

}



const MODEL_CONFIG_GRID =
  "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center sm:gap-3";

export function DeepSeekModelConfigRow({
  model,
  checked,
  modelId,
  modelIdLabel,
  onCheckedChange,
  onModelIdChange,
}: DeepSeekModelConfigRowProps) {
  const modelIdInputId = `single-model-id-${model.canonicalId}`;

  return (
    <div
      className={cn(
        "px-3 py-2.5 transition-colors",
        MODEL_CONFIG_GRID,
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
    </div>
  );
}



interface DeepSeekModelIdEditRowProps {

  readonly canonicalId: string;

  readonly label: string;

  readonly modelId: string;

  readonly modelIdLabel: string;

  readonly onModelIdChange: (value: string) => void;

}



export function DeepSeekModelIdEditRow({

  canonicalId,

  label,

  modelId,

  modelIdLabel,

  onModelIdChange,

}: DeepSeekModelIdEditRowProps) {

  const modelIdInputId = `single-model-edit-id-${canonicalId}`;



  return (
    <div className={cn("px-3 py-2.5", MODEL_CONFIG_GRID)}>
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

}



export function DeepSeekModelIdEditList({

  rows,

  modelColumnLabel,

  modelIdLabel,

  onModelIdChange,

}: DeepSeekModelIdEditListProps) {

  return (

    <div className="overflow-hidden rounded-lg border">

      <div
        className={cn(
          "text-muted-foreground border-b bg-muted/40 px-3 py-2 text-xs font-medium",
          MODEL_CONFIG_GRID
        )}
      >
        <span>{modelColumnLabel}</span>
        <span className="pl-6 sm:pl-0">{modelIdLabel}</span>
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

}



export function DeepSeekModelConfigList({

  models,

  checkedCanonicalIds,

  draftsByCanonicalId,

  modelColumnLabel,

  modelIdLabel,

  onCheckedChange,

  onModelIdChange,

}: DeepSeekModelConfigListProps) {

  return (

    <div className="overflow-hidden rounded-lg border">

      <div
        className={cn(
          "text-muted-foreground border-b bg-muted/40 px-3 py-2 text-xs font-medium",
          MODEL_CONFIG_GRID
        )}
      >
        <span>{modelColumnLabel}</span>
        <span className="pl-6 sm:pl-0">{modelIdLabel}</span>
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

            />

          );

        })}

      </div>

    </div>

  );

}

