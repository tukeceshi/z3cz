import { type CloudflareModelMeta, cloudflareDocsUrl } from "@dafthunk/types";

import type { TranslateFn } from "@/i18n";

export type { CloudflareModelMeta } from "@dafthunk/types";
export {
  CF_LOCKED_KEY,
  CF_META_KEY,
  CLOUDFLARE_MODEL_NODE_TYPE,
  cloudflareDocsUrl,
  encodeCloudflareModelMeta,
  shortName,
} from "@dafthunk/types";

export function decodeCloudflareModelMeta(value: unknown): CloudflareModelMeta {
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    const parsed = JSON.parse(value) as CloudflareModelMeta;
    return {
      description:
        typeof parsed.description === "string" ? parsed.description : undefined,
      taskName:
        typeof parsed.taskName === "string" ? parsed.taskName : undefined,
    };
  } catch {
    return {};
  }
}

export function deriveCloudflareModelDocs(
  modelId: string,
  meta: CloudflareModelMeta,
  t: TranslateFn
): { description: string; documentation: string; referenceUrl: string } {
  const referenceUrl = cloudflareDocsUrl(modelId);

  const description =
    meta.description ??
    (meta.taskName
      ? t("workflow.widgets.model.docs.cloudflareDescriptionWithTask", {
          taskName: meta.taskName,
          modelId,
        })
      : t("workflow.widgets.model.docs.cloudflareDescriptionFallback", {
          modelId,
        }));

  const lines: string[] = [
    t("workflow.widgets.model.docs.selectedModelHeading"),
    "",
    t("workflow.widgets.model.docs.identifierLine", { modelId }),
  ];
  if (meta.taskName) {
    lines.push(
      t("workflow.widgets.model.docs.taskLine", { taskName: meta.taskName })
    );
  }
  if (meta.description) {
    lines.push("");
    lines.push(meta.description);
  }
  lines.push("");
  lines.push(
    t("workflow.widgets.model.docs.cloudflareSeeModelPage", { url: referenceUrl })
  );
  lines.push("");
  lines.push(t("workflow.widgets.model.docs.cloudflareSwitchModelHint"));

  return { description, documentation: lines.join("\n"), referenceUrl };
}
