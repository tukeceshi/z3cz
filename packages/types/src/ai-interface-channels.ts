export type AiInterfaceChannelId = "volcano" | "single-model";

export type AiInterfaceChannelWizard = "volcano" | "single-model";

export interface AiInterfaceChannelDefinition {
  readonly id: AiInterfaceChannelId;
  readonly wizard: AiInterfaceChannelWizard;
  readonly recommended?: boolean;
  readonly tagKeys: readonly string[];
}

export const AI_INTERFACE_CHANNELS: readonly AiInterfaceChannelDefinition[] = [
  {
    id: "volcano",
    wizard: "volcano",
    recommended: true,
    tagKeys: [
      "pages.aiInterfaces.channels.volcano.tags.cloudStorage",
      "pages.aiInterfaces.channels.volcano.tags.seedance",
      "pages.aiInterfaces.channels.volcano.tags.doubao",
      "pages.aiInterfaces.channels.volcano.tags.usage",
    ],
  },
  {
    id: "single-model",
    wizard: "single-model",
    tagKeys: [
      "pages.aiInterfaces.channels.singleModel.tags.openAiCompatible",
      "pages.aiInterfaces.channels.singleModel.tags.customBaseUrl",
      "pages.aiInterfaces.channels.singleModel.tags.textImage",
    ],
  },
] as const;

export function getAiInterfaceChannel(
  id: AiInterfaceChannelId
): AiInterfaceChannelDefinition | undefined {
  return AI_INTERFACE_CHANNELS.find((channel) => channel.id === id);
}

export function totalWizardSteps(channelId: AiInterfaceChannelId): number {
  return channelId === "volcano" ? 5 : 4;
}
