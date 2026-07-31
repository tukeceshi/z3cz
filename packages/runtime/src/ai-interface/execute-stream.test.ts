import { describe, expect, it } from "vitest";

import { artifactSupportsChatStream } from "./execute-stream";
import type { AiInterfaceRuntimeArtifact } from "@dafthunk/types";

describe("artifactSupportsChatStream", () => {
  it("returns true for openai-messages sync artifacts", () => {
    const artifact = {
      execution: {
        mode: "sync",
        sync: {
          bodySlots: [{ kind: "openai-messages", to: "messages" }],
        },
      },
    } as AiInterfaceRuntimeArtifact;

    expect(artifactSupportsChatStream(artifact)).toBe(true);
  });

  it("returns false for anthropic-only artifacts", () => {
    const artifact = {
      execution: {
        mode: "sync",
        sync: {
          bodySlots: [{ kind: "anthropic-messages", to: "messages" }],
        },
      },
    } as AiInterfaceRuntimeArtifact;

    expect(artifactSupportsChatStream(artifact)).toBe(false);
  });
});
