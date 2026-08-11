import { useMemo } from "react";

import { usePlatformModelChannels } from "@/services/platform-ai-model-service";

function channelDisplayNames(
  channels: readonly { readonly channel: string; readonly displayName: string; readonly sortOrder: number }[],
  kind: "aggregate" | "api"
): readonly string[] {
  return [...channels]
    .filter((channel) => channel.channel === kind)
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        a.displayName.localeCompare(b.displayName)
    )
    .map((channel) => channel.displayName);
}

export function useChannelSupportedModels(organizationId: string | undefined) {
  const { channels } = usePlatformModelChannels(organizationId);

  return useMemo(
    () => ({
      volcanoModelNames: channelDisplayNames(channels, "aggregate"),
      singleModelNames: channelDisplayNames(channels, "api"),
    }),
    [channels]
  );
}
