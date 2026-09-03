import { describe, expect, it } from "vitest";
import type { OrgTextModelOption } from "@dafthunk/types";
import { fingerprintAgentChatBody } from "@dafthunk/types";

import {
  agentContextUsage,
  estimateAgentContextUsedTokens,
  formatAgentContextTokenCount,
  groupAgentChatTurns,
  resolveAgentContextModel,
  shouldFetchSealedAgentChatBody,
  shouldSubmitAgentChatOnEnter,
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
    expect(turns[0]?.assistant?.id).toBe("a1");
    expect(turns[1]?.assistant).toBeNull();
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
