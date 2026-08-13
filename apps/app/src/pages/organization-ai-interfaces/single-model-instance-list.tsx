import type { AiModelModality, SingleModelInstanceDraft } from "@dafthunk/types";
import {
  createSingleModelInstanceDraft,
  defaultUpstreamModelIdForCanonical,
} from "@dafthunk/types";
import { Settings, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CredentialPlainInput } from "@/components/credential-secret-input";
import { useTranslation } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";

import type { ProviderModelConfigOption } from "./deepseek-model-config-row";
import { resolveDeepSeekModelCardName } from "./single-model-display-name";

export interface ProviderModelPoolOption extends ProviderModelConfigOption {
  readonly modality: AiModelModality;
}

interface SingleModelInstanceListProps {
  readonly availableModels: readonly ProviderModelPoolOption[];
  readonly instances: readonly SingleModelInstanceDraft[];
  readonly onChange: (instances: readonly SingleModelInstanceDraft[]) => void;
  readonly modelColumnLabel: string;
  readonly modelIdLabel: string;
  readonly addModelLabel: string;
  readonly showCapabilitySettings?: boolean;
  readonly onOpenCapabilitySettings?: (instanceId: string) => void;
  readonly capabilitySettingsLabel?: string;
}

const ADD_COOLDOWN_MS = 600;

const INSTANCE_GRID =
  "grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-3";

export function SingleModelInstanceList({
  availableModels,
  instances,
  onChange,
  modelColumnLabel,
  modelIdLabel,
  addModelLabel,
  showCapabilitySettings = false,
  onOpenCapabilitySettings,
  capabilitySettingsLabel,
}: SingleModelInstanceListProps) {
  const { t } = useTranslation();
  const [addLockedCanonicalId, setAddLockedCanonicalId] = useState<
    string | null
  >(null);
  const cooldownRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current !== null) {
        window.clearTimeout(cooldownRef.current);
      }
    };
  }, []);

  const updateInstance = (
    instanceId: string,
    patch: Partial<SingleModelInstanceDraft>
  ) => {
    onChange(
      instances.map((instance) =>
        instance.instanceId === instanceId ? { ...instance, ...patch } : instance
      )
    );
  };

  const handleAdd = (model: ProviderModelPoolOption) => {
    if (addLockedCanonicalId === model.canonicalId) {
      return;
    }

    onChange([
      ...instances,
      createSingleModelInstanceDraft({
        canonicalId: model.canonicalId,
        displayName: model.displayName,
        modality: model.modality,
        upstreamModelId: defaultUpstreamModelIdForCanonical(model.canonicalId),
        enabled: true,
      }),
    ]);
    setAddLockedCanonicalId(model.canonicalId);
    if (cooldownRef.current !== null) {
      window.clearTimeout(cooldownRef.current);
    }
    cooldownRef.current = window.setTimeout(() => {
      setAddLockedCanonicalId(null);
      cooldownRef.current = null;
    }, ADD_COOLDOWN_MS);
  };

  const handleRemove = (instanceId: string) => {
    onChange(instances.filter((instance) => instance.instanceId !== instanceId));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2">
        {availableModels.map((model) => {
          const displayName = resolveDeepSeekModelCardName(
            model.canonicalId,
            model.displayName
          );
          const addLocked = addLockedCanonicalId === model.canonicalId;

          return (
            <div
              key={model.canonicalId}
              className="flex flex-col gap-2 rounded-lg border p-3"
            >
              <span className="truncate text-sm font-medium">{displayName}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={addLocked}
                onClick={() => handleAdd(model)}
              >
                {addModelLabel}
              </Button>
            </div>
          );
        })}
      </div>

      {instances.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          {t("pages.aiInterfaces.singleModel.noModelsAdded")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div
            className={cn(
              "text-muted-foreground border-b bg-muted/40 px-3 py-2 text-xs font-medium",
              INSTANCE_GRID
            )}
          >
            <span>{modelColumnLabel}</span>
            <span className="pl-6 sm:pl-0">{modelIdLabel}</span>
            <span className="text-right sm:text-left">{t("common.actions")}</span>
          </div>
          <div className="divide-y">
            {instances.map((instance) => (
              <div
                key={instance.instanceId}
                className={cn("px-3 py-2.5", INSTANCE_GRID)}
              >
                <div className="min-w-0 pl-6 sm:pl-0">
                  <CredentialPlainInput
                    id={`single_model_name_${instance.instanceId}`}
                    name={`single_model_name_${instance.instanceId}`}
                    aria-label={`${modelColumnLabel} ${instance.canonicalId}`}
                    className="h-9 w-full text-sm"
                    value={instance.displayName}
                    onChange={(event) =>
                      updateInstance(instance.instanceId, {
                        displayName: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="min-w-0 pl-6 sm:pl-0">
                  <CredentialPlainInput
                    id={`single_model_upstream_${instance.instanceId}`}
                    name={`single_model_upstream_${instance.instanceId}`}
                    aria-label={`${instance.displayName} ${modelIdLabel}`}
                    className="h-9 w-full font-mono text-xs"
                    value={instance.upstreamModelId}
                    onChange={(event) =>
                      updateInstance(instance.instanceId, {
                        upstreamModelId: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-end gap-1 pl-6 sm:pl-0">
                  {showCapabilitySettings &&
                  instance.modality === "video" &&
                  onOpenCapabilitySettings ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      onClick={() =>
                        onOpenCapabilitySettings(instance.instanceId)
                      }
                      aria-label={capabilitySettingsLabel}
                    >
                      <Settings className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                    onClick={() => handleRemove(instance.instanceId)}
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
