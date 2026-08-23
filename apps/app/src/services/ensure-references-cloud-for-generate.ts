import type { WorkflowMediaValue } from "@dafthunk/types";
import { getResourceIdFromValue } from "@dafthunk/types";
import { toast } from "sonner";

import {
  createTranslator,
  getCachedLocaleDictionary,
  readStoredLocale,
  resolveInitialLocale,
  type TranslationKey,
} from "@/i18n";
import { en } from "@/i18n/locales/en";
import { zh } from "@/i18n/locales/zh";
import { readGenerativeStagingBlob } from "@/services/generative-media-staging";
import { isResourceIdCloudResolvable } from "@/services/resolve-resource-ids-on-server";
import { uploadGenerativeMediaFromLocalStaging } from "@/services/stage-generative-media";

function translateApp(key: TranslationKey): string {
  const locale = readStoredLocale() ?? resolveInitialLocale("en");
  const dictionary =
    getCachedLocaleDictionary(locale) ?? (locale === "zh" ? zh : en);
  const fallback = locale === "zh" ? en : undefined;
  return createTranslator(locale, dictionary, fallback)(key);
}

function withoutCloudUploadFailed(
  item: WorkflowMediaValue
): WorkflowMediaValue {
  if (item.cloudUploadFailed !== true) {
    return item;
  }
  const { cloudUploadFailed: _ignored, ...rest } = item;
  return rest;
}

async function resourceNeedsCloudUpload(params: {
  readonly organizationId: string;
  readonly resourceId: string;
}): Promise<boolean> {
  return !(await isResourceIdCloudResolvable({
    organizationId: params.organizationId,
    resourceId: params.resourceId,
  }));
}

/** Before generate: retry cloud upload until every reference resolves on the server. */
export async function ensureReferencesCloudForGenerate(params: {
  readonly organizationId: string;
  readonly workflowId: string;
  readonly media: readonly WorkflowMediaValue[];
  readonly cloudConfigured: boolean;
}): Promise<readonly WorkflowMediaValue[]> {
  if (!params.cloudConfigured || params.media.length === 0) {
    return params.media;
  }

  const pending: WorkflowMediaValue[] = [];
  for (const item of params.media) {
    const resourceId = getResourceIdFromValue(item);
    if (!resourceId) {
      pending.push(item);
      continue;
    }
    if (
      await resourceNeedsCloudUpload({
        organizationId: params.organizationId,
        resourceId,
      })
    ) {
      pending.push(item);
    }
  }

  if (pending.length === 0) {
    return params.media.map(withoutCloudUploadFailed);
  }

  const toastId = toast.loading(
    translateApp("workflow.generativeErrors.uploadingReferencesToCloud")
  );

  try {
    const next: WorkflowMediaValue[] = [];

    for (const item of params.media) {
      const resourceId = getResourceIdFromValue(item);
      if (!resourceId) {
        next.push(item);
        continue;
      }

      const needsUpload = await resourceNeedsCloudUpload({
        organizationId: params.organizationId,
        resourceId,
      });
      if (!needsUpload) {
        next.push(withoutCloudUploadFailed(item));
        continue;
      }

      const staging = await readGenerativeStagingBlob({
        mediaId: resourceId,
        organizationId: params.organizationId,
        workflowId: params.workflowId,
      });
      if (!staging) {
        throw new Error(
          translateApp("workflow.generativeErrors.referenceCloudUploadFailed")
        );
      }

      await uploadGenerativeMediaFromLocalStaging({
        organizationId: params.organizationId,
        workflowId: params.workflowId,
        mediaId: resourceId,
        mimeType: item.mimeType ?? staging.mimeType,
        objectId: resourceId,
      });

      const cloudReady = await isResourceIdCloudResolvable({
        organizationId: params.organizationId,
        resourceId,
      });
      if (!cloudReady) {
        throw new Error(
          translateApp("workflow.generativeErrors.referenceCloudUploadFailed")
        );
      }

      next.push(withoutCloudUploadFailed(item));
    }

    return next;
  } finally {
    toast.dismiss(toastId);
  }
}
