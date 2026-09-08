import { describe, expect, it } from "vitest";

import {
  artifactSupportsChatStream,
  readOpenAiReasoningDelta,
  splitThinkTags,
} from "./execute-stream";
import type { AiInterfaceRuntimeArtifact } from "@dafthunk/types";

describe("splitThinkTags", () => {
  it("leaves unmarked text as talk", () => {
    expect(splitThinkTags("直接回答")).toEqual({
      thinking: "",
      talk: "直接回答",
    });
  });

  it("pulls think blocks out of content", () => {
    expect(splitThinkTags("<think>先看</think>可以这样做")).toEqual({
      thinking: "先看",
      talk: "可以这样做",
    });
  });

  it("treats an unclosed think block as thinking", () => {
    expect(splitThinkTags("前言<think>还在想")).toEqual({
      thinking: "还在想",
      talk: "前言",
    });
  });

  it("holds back an incomplete opening tag", () => {
    expect(splitThinkTags("hello <th")).toEqual({
      thinking: "",
      talk: "hello ",
    });
  });
});

describe("readOpenAiReasoningDelta", () => {
  it("reads reasoning_content from a choice delta", () => {
    expect(
      readOpenAiReasoningDelta({
        choices: [{ delta: { reasoning_content: "hmm" } }],
      })
    ).toBe("hmm");
  });

  it("reads reasoning when reasoning_content is absent", () => {
    expect(
      readOpenAiReasoningDelta({
        choices: [{ delta: { reasoning: "再想" } }],
      })
    ).toBe("再想");
  });

  it("returns empty when only talk content is present", () => {
    expect(
      readOpenAiReasoningDelta({
        choices: [{ delta: { content: "你好" } }],
      })
    ).toBe("");
  });
});

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
