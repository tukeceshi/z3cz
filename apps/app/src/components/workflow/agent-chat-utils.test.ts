import type { OrgTextModelOption } from "@dafthunk/types";
import { fingerprintAgentChatBody } from "@dafthunk/types";
import { describe, expect, it } from "vitest";

import {
  agentContextUsage,
  estimateAgentContextUsedTokens,
  formatAgentContextTokenCount,
  executeTraceTitle,
  shouldShowExecuteTrace,
  turnHasCompletedExecute,
  groupAgentChatTurns,
  isAgentThinkingLive,
  resolveAgentContextModel,
  selectableTextModelsInOrder,
  shouldFetchSealedAgentChatBody,
  shouldSubmitAgentChatOnEnter,
  shouldWrapAgentWorked,
  trimMessagesForContext,
} from "./agent-chat-utils";

describe("trimMessagesForContext", () => {
  it("keeps recent messages when the earlier ones exceed the window", () => {
    const trimmed = trimMessagesForContext({
      contextWindowTokens: 20,
      outputMaxTokens: 5,
      messages: [
        { id: "1", role: "user", content: "aaaaaaaaaa" },
        { id: "2", role: "assistant", content: "bbbbbbbbbb" },
        { id: "3", role: "user", content: "ccccc" },
      ],
    });

    expect(trimmed.map((message) => message.id)).toEqual(["2", "3"]);
  });

  it("does not drop the latest message even when it is long", () => {
    const trimmed = trimMessagesForContext({
      contextWindowTokens: 8,
      outputMaxTokens: 2,
      messages: [{ id: "1", role: "user", content: "0123456789abcdef" }],
    });

    expect(trimmed).toHaveLength(1);
    expect(trimmed[0]?.content).toHaveLength(6);
  });

  it("keeps system messages when trimming history", () => {
    const trimmed = trimMessagesForContext({
      contextWindowTokens: 25,
      outputMaxTokens: 5,
      messages: [
        { id: "sys", role: "system", content: "指令要留下" },
        { id: "1", role: "user", content: "aaaaaaaaaa" },
        { id: "2", role: "assistant", content: "bbbbbbbbbb" },
        { id: "3", role: "user", content: "ccccc" },
      ],
    });

    expect(trimmed.map((message) => message.id)).toEqual(["sys", "2", "3"]);
  });
});

describe("shouldFetchSealedAgentChatBody", () => {
  it("does not fetch unsealed conversations", () => {
    expect(
      shouldFetchSealedAgentChatBody({
        sealed: false,
        remoteFingerprint: "abc",
        localFingerprint: "",
      })
    ).toBe(false);
  });

  it("fetches sealed conversations when local fingerprint differs", () => {
    expect(
      shouldFetchSealedAgentChatBody({
        sealed: true,
        remoteFingerprint: "abc",
        localFingerprint: "def",
      })
    ).toBe(true);
  });

  it("skips fetch when sealed fingerprints match", () => {
    expect(
      shouldFetchSealedAgentChatBody({
        sealed: true,
        remoteFingerprint: "abc",
        localFingerprint: "abc",
      })
    ).toBe(false);
  });

  it("fetches sealed conversations when local has no fingerprint", () => {
    expect(
      shouldFetchSealedAgentChatBody({
        sealed: true,
        remoteFingerprint: "abc",
        localFingerprint: "",
      })
    ).toBe(true);
  });
});

describe("shouldSubmitAgentChatOnEnter", () => {
  it("submits on Enter without Shift", () => {
    expect(
      shouldSubmitAgentChatOnEnter({ key: "Enter", shiftKey: false })
    ).toBe(true);
  });

  it("does not submit on Shift+Enter", () => {
    expect(
      shouldSubmitAgentChatOnEnter({ key: "Enter", shiftKey: true })
    ).toBe(false);
  });

  it("does not submit while composing", () => {
    expect(
      shouldSubmitAgentChatOnEnter({
        key: "Enter",
        shiftKey: false,
        isComposing: true,
      })
    ).toBe(false);
    expect(
      shouldSubmitAgentChatOnEnter({
        key: "Enter",
        shiftKey: false,
        keyCode: 229,
      })
    ).toBe(false);
  });
});

describe("groupAgentChatTurns", () => {
  it("pairs each user message with the following assistant", () => {
    const turns = groupAgentChatTurns([
      { id: "u1", role: "user", content: "hi" },
      { id: "a1", role: "assistant", content: "hello" },
      { id: "u2", role: "user", content: "again" },
    ]);
    expect(turns).toHaveLength(2);
    expect(turns[0]?.answer.talk).toBe("hello");
    expect(turns[0]?.hasReply).toBe(true);
    expect(turns[1]?.hasReply).toBe(false);
    expect(turns[1]?.answer.talk).toBe("");
  });

  it("merges later assistants on the same turn into one answer", () => {
    const turns = groupAgentChatTurns([
      { id: "u1", role: "user", content: "hi" },
      { id: "a1", role: "assistant", content: "plan" },
      { id: "a2", role: "assistant", content: "run" },
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.answer.talk).toBe("run");
    expect(turns[0]?.executed).toBe(true);
  });
});

describe("isAgentThinkingLive", () => {
  it("is live only while streaming with no answer or tools", () => {
    expect(
      isAgentThinkingLive({ streaming: true, hasTalk: false, hasTools: false })
    ).toBe(true);
    expect(
      isAgentThinkingLive({ streaming: true, hasTalk: true, hasTools: false })
    ).toBe(false);
    expect(
      isAgentThinkingLive({ streaming: true, hasTalk: false, hasTools: true })
    ).toBe(false);
    expect(
      isAgentThinkingLive({ streaming: false, hasTalk: false, hasTools: false })
    ).toBe(false);
  });
});

describe("shouldWrapAgentWorked", () => {
  it("wraps finished process and leaves live turns unwrapped", () => {
    expect(
      shouldWrapAgentWorked({
        streaming: false,
        hasThinking: true,
        hasTools: false,
      })
    ).toBe(true);
    expect(
      shouldWrapAgentWorked({
        streaming: false,
        hasThinking: false,
        hasTools: true,
      })
    ).toBe(true);
    expect(
      shouldWrapAgentWorked({
        streaming: true,
        hasThinking: true,
        hasTools: false,
      })
    ).toBe(false);
    expect(
      shouldWrapAgentWorked({
        streaming: false,
        hasThinking: false,
        hasTools: false,
      })
    ).toBe(false);
  });
});

describe("fingerprintAgentChatBody", () => {
  it("changes when content changes", () => {
    expect(
      fingerprintAgentChatBody({
        messages: [{ id: "1", role: "user", content: "a" }],
      })
    ).not.toBe(
      fingerprintAgentChatBody({
        messages: [{ id: "1", role: "user", content: "b" }],
      })
    );
  });
});

describe("estimateAgentContextUsedTokens", () => {
  it("sums message and draft lengths, skipping empty content", () => {
    expect(
      estimateAgentContextUsedTokens(
        [
          { content: "hello" },
          { content: "" },
          { content: "world" },
        ],
        "!!"
      )
    ).toBe(12);
  });

  it("returns 0 when there is no content", () => {
    expect(estimateAgentContextUsedTokens([{ content: "" }], "")).toBe(0);
  });
});

describe("agentContextUsage", () => {
  it("marks warn and full by fill ratio", () => {
    expect(agentContextUsage({ used: 69, limit: 100 }).tone).toBe("normal");
    expect(agentContextUsage({ used: 70, limit: 100 }).tone).toBe("warn");
    expect(agentContextUsage({ used: 90, limit: 100 }).tone).toBe("full");
  });
});

describe("formatAgentContextTokenCount", () => {
  it("uses compact k and m labels", () => {
    expect(formatAgentContextTokenCount(12)).toBe("12");
    expect(formatAgentContextTokenCount(12_400)).toBe("12.4k");
    expect(formatAgentContextTokenCount(128_000)).toBe("128k");
    expect(formatAgentContextTokenCount(1_048_576)).toBe("1m");
  });
});

describe("resolveAgentContextModel", () => {
  const first = { optionId: "a" } as OrgTextModelOption;
  const second = { optionId: "b" } as OrgTextModelOption;

  it("uses the selected model, or the first model for Auto", () => {
    expect(resolveAgentContextModel("b", [first, second])).toBe(second);
    expect(resolveAgentContextModel("auto", [first, second])).toBe(first);
    expect(resolveAgentContextModel("missing", [first, second])).toBe(first);
    expect(resolveAgentContextModel("auto", [])).toBeNull();
  });
});

describe("selectableTextModelsInOrder", () => {
  function model(params: {
    readonly optionId: string;
    readonly sortOrder: number;
    readonly usesOfficialUrl: boolean;
    readonly selectable?: boolean;
  }): OrgTextModelOption {
    return {
      optionId: params.optionId,
      instanceId: params.optionId,
      canonicalId: params.optionId,
      interfaceId: "iface",
      channelKind: params.usesOfficialUrl ? "aggregate" : "api",
      alias: params.optionId,
      displayName: params.optionId,
      modality: "text",
      providerModelId: params.optionId,
      parameterRules: {
        schemaVersion: 1,
        referenceInputs: [],
        keywordsMaxChars: 1,
        promptMaxChars: 1,
        outputMaxTokens: 1,
        outputMaxTokensLimit: 1,
        outputMaxChars: 1,
        contextWindowTokens: 1,
        maxTextReferences: 0,
        maxTextReferenceChars: 1,
        maxImageReferences: 0,
        maxImageReferenceBytes: 1,
        maxVideoReferences: 0,
        maxVideoReferenceBytes: 1,
        maxVideoReferenceSeconds: 1,
      },
      selectable: params.selectable ?? true,
      description: "",
      sortOrder: params.sortOrder,
      brandIcon: null,
      usesOfficialUrl: params.usesOfficialUrl,
    };
  }

  it("puts official endpoints first, then sortOrder", () => {
    const sorted = selectableTextModelsInOrder([
      model({ optionId: "relay", sortOrder: 0, usesOfficialUrl: false }),
      model({ optionId: "official-b", sortOrder: 20, usesOfficialUrl: true }),
      model({ optionId: "official-a", sortOrder: 10, usesOfficialUrl: true }),
      model({
        optionId: "disabled",
        sortOrder: 0,
        usesOfficialUrl: true,
        selectable: false,
      }),
    ]);

    expect(sorted.map((entry) => entry.optionId)).toEqual([
      "official-a",
      "official-b",
      "relay",
    ]);
  });
});

describe("executeTraceTitle", () => {
  it("uses the latest assistant talk", () => {
    const turns = groupAgentChatTurns([
      { id: "u1", role: "user", content: "hi" },
      {
        id: "a1",
        role: "assistant",
        content: `${"<<<THINK>>>"}\n先看\n${"<<<TALK>>>"}\n改片头`,
      },
      {
        id: "a2",
        role: "assistant",
        content: `${"<<<THINK>>>"}\n动手\n${"<<<TALK>>>"}\n已经改好`,
      },
    ]);
    expect(executeTraceTitle(turns[0]?.answer ?? { thinking: "", tools: [], talk: "" })).toBe(
      "已经改好"
    );
  });

  it("is empty until a talk exists", () => {
    const turns = groupAgentChatTurns([
      { id: "u1", role: "user", content: "hi" },
      { id: "a1", role: "assistant", content: `${"<<<THINK>>>"}\n还在想` },
    ]);
    expect(executeTraceTitle(turns[0]?.answer ?? { thinking: "", tools: [], talk: "" })).toBe(
      ""
    );
  });
});

describe("shouldShowExecuteTrace", () => {
  it("shows the bar once an assistant reply exists", () => {
    expect(shouldShowExecuteTrace(false)).toBe(false);
    expect(shouldShowExecuteTrace(true)).toBe(true);
  });
});

describe("turnHasCompletedExecute", () => {
  it("is true only after a follow-up assistant from execute", () => {
    const planOnly = groupAgentChatTurns([
      { id: "u1", role: "user", content: "hi" },
      {
        id: "a1",
        role: "assistant",
        content: `${"<<<TALK>>>"}\n改片头`,
      },
    ]);
    expect(turnHasCompletedExecute(planOnly[0]?.executed ?? false)).toBe(false);
    const executed = groupAgentChatTurns([
      { id: "u1", role: "user", content: "hi" },
      {
        id: "a1",
        role: "assistant",
        content: `${"<<<TALK>>>"}\n改片头`,
      },
      {
        id: "a2",
        role: "assistant",
        content: `${"<<<TALK>>>"}\n已经改好`,
      },
    ]);
    expect(turnHasCompletedExecute(executed[0]?.executed ?? false)).toBe(true);
  });
});
