import React, { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/locale-provider";

import type { WorkflowParameter } from "./workflow-types";

const ModelViewerElement = React.forwardRef<HTMLElement, any>((props, ref) => {
  return React.createElement("model-viewer", { ...props, ref });
});

export interface ModelViewerProps {
  parameter: WorkflowParameter;
  objectUrl: string;
}

function useModelViewer(onViewerLoadFailed: () => string) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("@google/model-viewer")
        .then(() => setIsLoaded(true))
        .catch(() => setLoadError(onViewerLoadFailed()));
    }
  }, [onViewerLoadFailed]);

  return { isLoaded, loadError };
}

function useAuthenticatedModelUrl(
  url: string,
  onModelLoadFailed: () => string
) {
  const [authenticatedUrl, setAuthenticatedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (isCancelled) return;

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        if (isCancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }

        blobUrlRef.current = blobUrl;
        setAuthenticatedUrl(blobUrl);
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : onModelLoadFailed());
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadModel();

    return () => {
      isCancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [url, onModelLoadFailed]);

  return { authenticatedUrl, isLoading, error };
}

export const ModelViewer = React.memo(
  ({ parameter, objectUrl }: ModelViewerProps) => {
    const { t } = useTranslation();
    const loadViewerFailed = useCallback(
      () => t("workflow.widgets.modelViewer.loadViewerFailed"),
      [t]
    );
    const loadModelFailed = useCallback(
      () => t("workflow.widgets.modelViewer.loadModelFailed"),
      [t]
    );
    const { isLoaded: isModelViewerLoaded, loadError } =
      useModelViewer(loadViewerFailed);
    const { authenticatedUrl, isLoading, error } = useAuthenticatedModelUrl(
      objectUrl,
      loadModelFailed
    );

    const mimeType =
      parameter.type === "gltf"
        ? (parameter.value?.mimeType ?? "model/gltf-binary")
        : "model/gltf-binary";

    if (error || loadError) {
      return (
        <div className="space-y-2">
          <div className="p-3 bg-red-50 dark:bg-red-900/20">
            <div className="text-sm text-red-800 dark:text-red-200">
              {t("workflow.widgets.modelViewer.errorTitle")}
            </div>
            <div className="text-xs text-red-700 dark:text-red-300">
              {error || loadError}
            </div>
          </div>
          <div className="text-xs text-neutral-500">
            {t("workflow.widgets.modelViewer.gltfModelLabel", { mimeType })}
          </div>
          <a
            href={objectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline"
          >
            {t("workflow.widgets.modelViewer.downloadGlb")}
          </a>
        </div>
      );
    }

    if (!isModelViewerLoaded || isLoading || !authenticatedUrl) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-neutral-100/50 dark:bg-neutral-900">
          <span className="text-xs text-neutral-500">
            {!isModelViewerLoaded
              ? t("workflow.widgets.modelViewer.loadingViewer")
              : t("workflow.widgets.modelViewer.loadingModel")}
          </span>
        </div>
      );
    }

    return (
      <div
        className="w-full h-full bg-neutral-100/50 dark:bg-neutral-900 overflow-hidden nodrag nopan nowheel"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ModelViewerElement
          src={authenticatedUrl}
          camera-controls
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: "transparent",
          }}
        />
      </div>
    );
  }
);

ModelViewer.displayName = "ModelViewer";
