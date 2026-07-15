import type {
  PlatformFeatureCategory,
  ResourceFeatureId,
} from "@dafthunk/types";
import { RESOURCE_FEATURE_IDS } from "@dafthunk/types";

import type { TranslationKey } from "@/i18n";

export interface FeatureEnvVar {
  key: string;
  hintKey: TranslationKey;
}

export interface FeatureCatalogEntry {
  id: ResourceFeatureId;
  category: PlatformFeatureCategory;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  envVars: FeatureEnvVar[];
}

export { RESOURCE_FEATURE_IDS };

export const FEATURE_CATALOG: Record<ResourceFeatureId, FeatureCatalogEntry> = {
  schemas: {
    id: "schemas",
    category: "admin",
    labelKey: "sidebar.schemas",
    descriptionKey: "featureSettings.descriptions.schemas",
    envVars: [],
  },
  databases: {
    id: "databases",
    category: "admin",
    labelKey: "sidebar.databases",
    descriptionKey: "featureSettings.descriptions.databases",
    envVars: [],
  },
  datasets: {
    id: "datasets",
    category: "admin_and_docker",
    labelKey: "sidebar.datasets",
    descriptionKey: "featureSettings.descriptions.datasets",
    envVars: [
      { key: "CLOUDFLARE_ACCOUNT_ID", hintKey: "featureSettings.env.cloudflareAccountId" },
      { key: "CLOUDFLARE_API_TOKEN", hintKey: "featureSettings.env.cloudflareApiToken" },
    ],
  },
  integrations: {
    id: "integrations",
    category: "admin_and_docker",
    labelKey: "sidebar.integrations",
    descriptionKey: "featureSettings.descriptions.integrations",
    envVars: [
      {
        key: "INTEGRATION_GOOGLE_MAIL_CLIENT_ID",
        hintKey: "featureSettings.env.integrationGoogleMailClientId",
      },
      {
        key: "INTEGRATION_GOOGLE_MAIL_CLIENT_SECRET",
        hintKey: "featureSettings.env.integrationGoogleMailClientSecret",
      },
      {
        key: "INTEGRATION_DISCORD_CLIENT_ID",
        hintKey: "featureSettings.env.integrationDiscordClientId",
      },
      {
        key: "INTEGRATION_DISCORD_CLIENT_SECRET",
        hintKey: "featureSettings.env.integrationDiscordClientSecret",
      },
    ],
  },
  secrets: {
    id: "secrets",
    category: "admin",
    labelKey: "sidebar.secrets",
    descriptionKey: "featureSettings.descriptions.secrets",
    envVars: [],
  },
  "ai-interfaces": {
    id: "ai-interfaces",
    category: "admin_and_docker",
    labelKey: "sidebar.aiInterfaces",
    descriptionKey: "featureSettings.descriptions.aiInterfaces",
    envVars: [
      { key: "CLOUDFLARE_ACCOUNT_ID", hintKey: "featureSettings.env.cloudflareAccountId" },
      { key: "CLOUDFLARE_API_TOKEN", hintKey: "featureSettings.env.cloudflareApiToken" },
    ],
  },
  emails: {
    id: "emails",
    category: "admin_and_docker",
    labelKey: "sidebar.emails",
    descriptionKey: "featureSettings.descriptions.emails",
    envVars: [
      { key: "SEND_EMAIL", hintKey: "featureSettings.env.sendEmail" },
      { key: "SEND_EMAIL_FROM", hintKey: "featureSettings.env.sendEmailFrom" },
      { key: "EMAIL_DOMAIN", hintKey: "featureSettings.env.emailDomain" },
      { key: "INBOUND_EMAIL_SECRET", hintKey: "featureSettings.env.inboundEmailSecret" },
    ],
  },
  queues: {
    id: "queues",
    category: "admin",
    labelKey: "sidebar.queues",
    descriptionKey: "featureSettings.descriptions.queues",
    envVars: [],
  },
  bots: {
    id: "bots",
    category: "admin_and_docker",
    labelKey: "sidebar.bots",
    descriptionKey: "featureSettings.descriptions.bots",
    envVars: [
      {
        key: "INTEGRATION_DISCORD_CLIENT_ID",
        hintKey: "featureSettings.env.integrationDiscordClientId",
      },
      {
        key: "INTEGRATION_DISCORD_CLIENT_SECRET",
        hintKey: "featureSettings.env.integrationDiscordClientSecret",
      },
    ],
  },
};

export function buildDockerCommand(featureId: ResourceFeatureId): string | null {
  const entry = FEATURE_CATALOG[featureId];
  if (entry.envVars.length === 0) {
    return null;
  }

  const envLines = entry.envVars.map((item) => `${item.key}=`).join("\n");
  return [
    "# .env.docker",
    envLines,
    "",
    "docker compose up -d",
  ].join("\n");
}
