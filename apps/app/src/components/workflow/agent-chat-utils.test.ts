import { describe, expect, it } from "vitest";
import { fingerprintAgentChatBody } from "@dafthunk/types";

import {
  groupAgentChatTurns,
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
