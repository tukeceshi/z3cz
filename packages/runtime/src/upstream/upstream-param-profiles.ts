import {
  SEEDANCE_2_0_T2V_OFFICIAL_V1,
  type UpstreamParamProfile,
} from "@dafthunk/types";

export const SEEDANCE_2_0_T2V_PROFILE: UpstreamParamProfile = {
  id: SEEDANCE_2_0_T2V_OFFICIAL_V1,
  name: "Seedance 2.0 Text to Video",
  description:
    "ByteDance Seedance 2.0 text-to-video via NewAPI relay. Parameters follow the official T2V schema.",
  referencePriceLabel: "参考价以 NewAPI 平台为准",
  relayModel: "seedance-2.0",
  createPath: "/v1/videos/generations",
  pollPathTemplate: "/v1/videos/generations/{taskId}",
  outputName: "video",
  outputType: "video",
  defaultPollIntervalSec: 10,
  defaultTimeoutMinutes: 30,
  fields: [
    {
      name: "prompt",
      apiName: "prompt",
      type: "string",
      description: "Scene description. Put spoken dialogue in double quotes.",
      required: true,
    },
    {
      name: "resolution",
      apiName: "resolution",
      type: "string",
      description: "480p, 720p, 1080p, or 4k",
      default: "720p",
      enumValues: ["480p", "720p", "1080p", "4k"],
    },
    {
      name: "duration",
      apiName: "duration",
      type: "string",
      description: '4–15 seconds, or "auto"',
      default: "auto",
      enumValues: [
        "auto",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "11",
        "12",
        "13",
        "14",
        "15",
      ],
    },
    {
      name: "aspect_ratio",
      apiName: "aspect_ratio",
      type: "string",
      description: "Framing for the generated clip",
      default: "auto",
      enumValues: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    },
    {
      name: "generate_audio",
      apiName: "generate_audio",
      type: "boolean",
      description: "Generate synchronized audio with the video",
      default: true,
    },
    {
      name: "bitrate_mode",
      apiName: "bitrate_mode",
      type: "string",
      description: "Output encode quality",
      default: "standard",
      enumValues: ["standard", "high"],
    },
    {
      name: "seed",
      apiName: "seed",
      type: "number",
      description: "Optional seed for reproducibility",
    },
  ],
};

const profiles: ReadonlyMap<string, UpstreamParamProfile> = new Map([
  [SEEDANCE_2_0_T2V_PROFILE.id, SEEDANCE_2_0_T2V_PROFILE],
]);

export function getUpstreamParamProfile(
  profileId: string
): UpstreamParamProfile | undefined {
  return profiles.get(profileId);
}

export function listUpstreamParamProfiles(): UpstreamParamProfile[] {
  return [...profiles.values()];
}

export function buildRelayRequestBody(
  profile: UpstreamParamProfile,
  inputs: Record<string, unknown>
): Record<string, unknown> | { error: string } {
  const body: Record<string, unknown> = {
    model: profile.relayModel,
  };

  for (const field of profile.fields) {
    const raw = inputs[field.name];
    const value =
      raw === undefined || raw === null || raw === ""
        ? field.default
        : raw;

    if (
      (value === undefined || value === null || value === "") &&
      field.required
    ) {
      return { error: `${field.name} is required` };
    }

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (field.type === "number") {
      const numeric = Number(value);
      if (Number.isNaN(numeric)) {
        return { error: `${field.name} must be a number` };
      }
      body[field.apiName] = numeric;
      continue;
    }

    if (field.type === "boolean") {
      body[field.apiName] = Boolean(value);
      continue;
    }

    body[field.apiName] = value;
  }

  return body;
}

export function resolvePollUrl(
  baseUrl: string,
  profile: UpstreamParamProfile,
  taskId: string,
  pollUrlFromResponse?: string
): string {
  if (pollUrlFromResponse && pollUrlFromResponse.startsWith("http")) {
    return pollUrlFromResponse;
  }

  const path = profile.pollPathTemplate.replace("{taskId}", taskId);
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function profileFieldsToNodeInputs(
  profile: UpstreamParamProfile
): import("@dafthunk/types").NodeType["inputs"] {
  return profile.fields.map((field) => ({
    name: field.name,
    type: field.type === "json" ? "json" : field.type,
    description: field.description,
    required: field.required,
    default: field.default,
    hidden: field.hidden,
    ...(field.enumValues ? { enum: [...field.enumValues] } : {}),
  }));
}
