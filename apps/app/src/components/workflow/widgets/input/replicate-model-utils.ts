import {
  type ReplicateModelMeta,
  replicateModelUrl,
  replicateOwnerName,
} from "@dafthunk/types";

import type { TranslateFn } from "@/i18n";

export type { ReplicateModelMeta } from "@dafthunk/types";
export {
  encodeReplicateModelMeta,
  REPLICATE_MODEL_NODE_TYPE,
  RP_META_KEY,
  replicateModelUrl,
  replicateOwnerName,
} from "@dafthunk/types";

export function decodeReplicateModelMeta(value: unknown): ReplicateModelMeta {
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    const parsed = JSON.parse(value) as ReplicateModelMeta;
    return {
      description:
        typeof parsed.description === "string" ? parsed.description : undefined,
    };
  } catch {
    return {};
  }
}

export function deriveReplicateModelDocs(
  modelId: string,
  meta: ReplicateModelMeta,
  t: TranslateFn
): { description: string; documentation: string; referenceUrl: string } {
  const referenceUrl = replicateModelUrl(modelId);
  const ownerName = replicateOwnerName(modelId);

  const description =
    meta.description ??
    t("workflow.widgets.model.docs.replicateDescriptionFallback", { ownerName });

  const lines: string[] = [
    t("workflow.widgets.model.docs.selectedModelHeading"),
    "",
    t("workflow.widgets.model.docs.identifierLine", { modelId }),
  ];
  if (meta.description) {
    lines.push("");
    lines.push(meta.description);
  }
  lines.push("");
  lines.push(
    t("workflow.widgets.model.docs.replicateSeeModelPage", { url: referenceUrl })
  );
  lines.push("");
  lines.push(t("workflow.widgets.model.docs.replicateReloadHint"));
  lines.push("");
  lines.push(
    t("workflow.widgets.model.docs.replicateBrowseCollection", {
      url: "https://replicate.com/explore",
    })
  );

  return { description, documentation: lines.join("\n"), referenceUrl };
}
