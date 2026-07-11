import {
  CFG_META_KEY,
  CLOUDFLARE_GATEWAY_MODEL_NODE_TYPE,
  type CloudflareGatewayModelMeta,
  cloudflareGatewayModelUrl,
  encodeCloudflareGatewayModelMeta,
} from "@dafthunk/types";

import type { TranslateFn } from "@/i18n";

export type { CloudflareGatewayModelMeta } from "@dafthunk/types";
export {
  CFG_META_KEY,
  CLOUDFLARE_GATEWAY_MODEL_NODE_TYPE,
  cloudflareGatewayModelUrl,
  encodeCloudflareGatewayModelMeta,
};

export function decodeCloudflareGatewayModelMeta(
  value: unknown
): CloudflareGatewayModelMeta {
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    const parsed = JSON.parse(value) as CloudflareGatewayModelMeta;
    return {
      description:
        typeof parsed.description === "string" ? parsed.description : undefined,
    };
  } catch {
    return {};
  }
}

export function deriveCloudflareGatewayModelDocs(
  modelId: string,
  meta: CloudflareGatewayModelMeta,
  t: TranslateFn
): { description: string; documentation: string; referenceUrl: string } {
  const referenceUrl = cloudflareGatewayModelUrl(modelId);

  const description =
    meta.description ??
    t("workflow.widgets.model.docs.gatewayDescriptionFallback", { modelId });

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
    t("workflow.widgets.model.docs.gatewaySeeModelPage", { url: referenceUrl })
  );
  lines.push("");
  lines.push(t("workflow.widgets.model.docs.gatewayReloadHint"));
  lines.push("");
  lines.push(
    t("workflow.widgets.model.docs.gatewayBrowseCatalog", {
      url: "https://developers.cloudflare.com/ai/models/",
    })
  );

  return { description, documentation: lines.join("\n"), referenceUrl };
}
