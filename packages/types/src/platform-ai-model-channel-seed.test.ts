import { describe, expect, it } from "vitest";

import {
  PLATFORM_AI_MODEL_CHANNEL_SEED,
  buildPlatformAiModelChannelSeed,
} from "./platform-ai-model-channel-seed";
import { VOLCANO_AGGREGATE_PRESET_ID } from "./platform-ai-model-channel";

describe("platform-ai-model-channel-seed", () => {
  it("builds a stable seed catalog", () => {
    expect(buildPlatformAiModelChannelSeed()).toEqual(
      PLATFORM_AI_MODEL_CHANNEL_SEED
    );
  });

  it("keeps Seedance 2.5 on api only", () => {
    const rows = PLATFORM_AI_MODEL_CHANNEL_SEED.filter(
      (row) => row.canonicalId === "doubao-seedance-2-5"
    );
    expect(rows).toEqual([
      {
        canonicalId: "doubao-seedance-2-5",
        channel: "api",
        presetId: "provider:seedance",
        upstreamModelId: "doubao-seedance-2-5-260628",
        channelEnabled: true,
      },
    ]);
  });

  it("registers aggregate volcano preset on aggregate rows", () => {
    const aggregateRows = PLATFORM_AI_MODEL_CHANNEL_SEED.filter(
      (row) => row.channel === "aggregate"
    );
    expect(aggregateRows.length).toBeGreaterThan(0);
    expect(
      aggregateRows.every((row) => row.presetId === VOLCANO_AGGREGATE_PRESET_ID)
    ).toBe(true);
  });
});
