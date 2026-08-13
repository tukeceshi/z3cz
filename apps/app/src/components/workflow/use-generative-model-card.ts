import { useNodes } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  UpstreamParamProfileField,
} from "@dafthunk/types";

import { useAppToast } from "@/hooks/use-app-toast";

import {
  resolveCardGenerationParams,
  type CardGenerationParams,
} from "./generative-card-params";
import { applyModelBindingToNodeData } from "./generative-model-binding";
import { generativeReferenceMetadataForModel } from "./generative-reference-metadata";
import {
  readWorkflowGenerativeDefault,
} from "./generative-workflow-defaults";
import {
  buildModelBindingOptionId,
  readModelSelectionRecord,
  resolveEffectiveGenerativeModel,
  resolveModelCardState,
  resolveSelectedModelBinding,
  type GenerativeModelModality,
  type ModelCardState,
  type OrgModelBindingRef,
} from "./org-model-selection-utils";
import { useWorkflow } from "./workflow-context";
import type { WorkflowNodeType } from "./workflow-types";

export interface OrgModelsQueryResult<T extends OrgModelBindingRef> {
  readonly models: readonly T[];
  readonly isLoading: boolean;
  readonly modelsError: unknown;
  readonly refreshModels: () => Promise<unknown>;
}

interface UseGenerativeModelCardParams<T extends OrgModelBindingRef> {
  readonly orgId: string | undefined;
  readonly modality: GenerativeModelModality;
  readonly data: WorkflowNodeType;
  readonly readModelId: (data: WorkflowNodeType) => string;
  readonly readInterfaceId: (data: WorkflowNodeType) => string;
  readonly readGenerationFields?: (model: T) => readonly UpstreamParamProfileField[];
  readonly buildDefaultParams?: (
    fields: readonly UpstreamParamProfileField[]
  ) => Record<string, unknown>;
  readonly useModels: (
    orgId: string | undefined,
    options?: { readonly enabled?: boolean }
  ) => OrgModelsQueryResult<T>;
  readonly disabled?: boolean;
  readonly updateNodeData?: (
    nodeId: string,
    updater: (current: WorkflowNodeType) => Partial<WorkflowNodeType>
  ) => void;
  readonly nodeId: string;
  readonly onModelSelected?: (
    model: T,
    current: WorkflowNodeType
  ) => Partial<Pick<WorkflowNodeType, "inputs" | "metadata">> | void;
  readonly modelFitsCurrentRefs?: (model: T) => boolean;
}

export interface UseGenerativeModelCardResult<T extends OrgModelBindingRef> {
  readonly cardState: ModelCardState<T>;
  readonly cardGenerationParams: CardGenerationParams;
  readonly effectiveModel: T | undefined;
  readonly selectedOptionId: string;
  readonly nodeInputs: WorkflowNodeType["inputs"];
  readonly models: readonly T[];
  readonly isLoading: boolean;
  readonly modelsError: unknown;
  readonly canGenerate: boolean;
  readonly handlePickerOpenChange: (open: boolean) => void;
  readonly applyModelSelection: (optionId: string) => void;
  readonly refreshModels: () => Promise<unknown>;
}

export function useGenerativeModelCard<T extends OrgModelBindingRef>({
  orgId,
  data,
  readModelId,
  readInterfaceId,
  readGenerationFields,
  buildDefaultParams,
  useModels,
  disabled = false,
  updateNodeData,
  nodeId,
  onModelSelected,
  modelFitsCurrentRefs,
  modality,
}: UseGenerativeModelCardParams<T>): UseGenerativeModelCardResult<T> {
  const toast = useAppToast();
  const nodes = useNodes();
  const { generativeDefaults, onGenerativeDefaultChange } = useWorkflow();
  const [listFetchEnabled, setListFetchEnabled] = useState(false);
  const [optimisticOptionId, setOptimisticOptionId] = useState<string | null>(
    null
  );
  const materializedRef = useRef<string>("");

  const liveData = useMemo((): WorkflowNodeType => {
    const node = nodes.find((entry) => entry.id === nodeId);
    return (node?.data as WorkflowNodeType | undefined) ?? data;
  }, [data, nodeId, nodes]);

  useEffect(() => {
    setListFetchEnabled(true);
  }, []);

  useEffect(() => {
    materializedRef.current = "";
  }, [nodeId]);

  const { models, isLoading, modelsError, refreshModels } = useModels(
    orgId,
    { enabled: listFetchEnabled && Boolean(orgId) }
  );

  useEffect(() => {
    setOptimisticOptionId(null);
  }, [nodeId]);

  const workflowDefault = useMemo(
    () => readWorkflowGenerativeDefault(generativeDefaults, modality),
    [generativeDefaults, modality]
  );

  const nodeBinding = useMemo(() => {
    const instanceValue = liveData.inputs?.find(
      (input) => input.id === "model_instance_id"
    )?.value;
    return readModelSelectionRecord({
      modelId: readModelId(liveData),
      interfaceId: readInterfaceId(liveData),
      instanceId: typeof instanceValue === "string" ? instanceValue : "",
    });
  }, [liveData, readInterfaceId, readModelId]);

  const optimisticBinding = useMemo(() => {
    if (!optimisticOptionId) {
      return undefined;
    }
    const model = models.find((entry) => entry.optionId === optimisticOptionId);
    if (!model) {
      return undefined;
    }
    return {
      canonicalId: model.canonicalId,
      interfaceId: model.interfaceId,
      instanceId: model.instanceId,
    };
  }, [models, optimisticOptionId]);

  const bindingForResolution = optimisticBinding ?? nodeBinding;

  const modelsPending =
    !listFetchEnabled || (isLoading && models.length === 0);

  const resolution = useMemo(() => {
    if (modelsPending || models.length === 0) {
      return undefined;
    }
    return resolveEffectiveGenerativeModel({
      nodeBinding: bindingForResolution,
      workflowDefault,
      models,
    });
  }, [bindingForResolution, models, modelsPending, workflowDefault]);

  const cardState = useMemo(
    () => resolveModelCardState(resolution, modelsPending),
    [modelsPending, resolution]
  );

  const effectiveModel =
    cardState.status === "ready" ? cardState.model : undefined;

  const generationFields = useMemo((): readonly UpstreamParamProfileField[] => {
    if (!readGenerationFields || !effectiveModel) {
      return [];
    }
    return readGenerationFields(effectiveModel);
  }, [effectiveModel, readGenerationFields]);

  const cardGenerationParams = useMemo(
    () =>
      resolveCardGenerationParams(
        Boolean(effectiveModel),
        liveData.inputs,
        generationFields
      ),
    [effectiveModel, generationFields, liveData.inputs]
  );

  useEffect(() => {
    if (disabled || !updateNodeData || modelsPending || !resolution) {
      return;
    }

    const matched = nodeBinding
      ? resolveSelectedModelBinding(
          models,
          nodeBinding.canonicalId,
          nodeBinding.interfaceId,
          nodeBinding.instanceId
        )
      : undefined;

    if (matched?.selectable) {
      const expectedMetadata = generativeReferenceMetadataForModel(
        modality,
        matched
      );
      const metadataStale =
        expectedMetadata !== undefined &&
        Object.entries(expectedMetadata).some(
          ([key, value]) => liveData.metadata?.[key] !== value
        );
      if (!metadataStale) {
        return;
      }

      const syncKey = `${nodeId}:${matched.optionId}:meta`;
      if (materializedRef.current === syncKey) {
        return;
      }
      materializedRef.current = syncKey;

      updateNodeData(nodeId, (current) => ({
        metadata: {
          ...(current.metadata ?? {}),
          ...expectedMetadata,
        },
      }));
      return;
    }

    const materializeKey = `${nodeId}:${resolution.model.optionId}`;
    if (materializedRef.current === materializeKey) {
      return;
    }
    materializedRef.current = materializeKey;

    updateNodeData(nodeId, (current) =>
      applyModelBindingToNodeData({
        model: resolution.model,
        current,
        modality,
        updateWorkflowDefault: false,
        generativeDefaults,
        workflowDefaultEntry: workflowDefault,
        handlers: {
          readGenerationFields,
          buildDefaultParams,
          onModelSelected,
        },
        onGenerativeDefaultChange,
      })
    );
  }, [
    buildDefaultParams,
    disabled,
    generativeDefaults,
    liveData.metadata,
    modality,
    models,
    modelsPending,
    nodeBinding,
    nodeId,
    onGenerativeDefaultChange,
    onModelSelected,
    readGenerationFields,
    resolution,
    updateNodeData,
    workflowDefault,
  ]);

  useEffect(() => {
    if (!optimisticOptionId || !nodeBinding) {
      return;
    }
    const model = models.find((entry) => entry.optionId === optimisticOptionId);
    if (
      model &&
      nodeBinding.canonicalId === model.canonicalId &&
      nodeBinding.interfaceId === model.interfaceId &&
      (nodeBinding.instanceId === undefined ||
        nodeBinding.instanceId === model.instanceId)
    ) {
      setOptimisticOptionId(null);
    }
  }, [models, optimisticOptionId, nodeBinding]);

  const selectedOptionId = useMemo(() => {
    if (effectiveModel) {
      return effectiveModel.optionId;
    }
    if (bindingForResolution) {
      const match = resolveSelectedModelBinding(
        models,
        bindingForResolution.canonicalId,
        bindingForResolution.interfaceId,
        bindingForResolution.instanceId
      );
      if (match) {
        return match.optionId;
      }
      return buildModelBindingOptionId(
        bindingForResolution.interfaceId,
        bindingForResolution.instanceId ?? bindingForResolution.canonicalId
      );
    }
    return optimisticOptionId ?? "";
  }, [bindingForResolution, effectiveModel, models, optimisticOptionId]);

  const canGenerate = Boolean(
    effectiveModel &&
      effectiveModel.selectable &&
      (modelFitsCurrentRefs ? modelFitsCurrentRefs(effectiveModel) : true)
  );

  const handlePickerOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setListFetchEnabled(true);
        void refreshModels();
      }
    },
    [refreshModels]
  );

  const applyModelSelection = useCallback(
    (optionId: string) => {
      if (disabled || !updateNodeData) {
        toast.error("workflow.generativeErrors.modelSelectionBlocked");
        return;
      }

      const model = models.find((entry) => entry.optionId === optionId);
      if (!model) {
        toast.error("workflow.generativeErrors.modelUnavailable");
        return;
      }
      if (!model.selectable) {
        toast.error("workflow.generativeErrors.modelUnavailable");
        return;
      }
      if (modelFitsCurrentRefs && !modelFitsCurrentRefs(model)) {
        toast.error("workflow.aiTextPanel.modelExceedsReferences");
        return;
      }

      setOptimisticOptionId(optionId);
      updateNodeData(nodeId, (current) => {
        const patch = applyModelBindingToNodeData({
          model,
          current,
          modality,
          updateWorkflowDefault: true,
          generativeDefaults,
          workflowDefaultEntry: workflowDefault,
          handlers: {
            readGenerationFields,
            buildDefaultParams,
            onModelSelected,
          },
          onGenerativeDefaultChange,
        });

        materializedRef.current = `${nodeId}:${model.optionId}`;

        return patch;
      });
    },
    [
      buildDefaultParams,
      disabled,
      generativeDefaults,
      modality,
      modelFitsCurrentRefs,
      models,
      nodeId,
      onGenerativeDefaultChange,
      onModelSelected,
      readGenerationFields,
      toast,
      updateNodeData,
      workflowDefault,
    ]
  );

  return {
    cardState,
    cardGenerationParams,
    effectiveModel,
    selectedOptionId,
    nodeInputs: liveData.inputs,
    models,
    isLoading: modelsPending,
    modelsError,
    canGenerate,
    handlePickerOpenChange,
    applyModelSelection,
    refreshModels,
  };
}
