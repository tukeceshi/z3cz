import { describe, expect, it } from "vitest";

import {
  filterMentionNodes,
  insertMention,
  mentionQueryAtCaret,
} from "./agent-composer-mentions";

describe("mentionQueryAtCaret", () => {
  it("reads the query after @", () => {
    expect(mentionQueryAtCaret("看 @猫", 4)).toEqual({
      start: 2,
      query: "猫",
    });
  });

  it("ignores @ in the middle of a word", () => {
    expect(mentionQueryAtCaret("a@b", 3)).toBeUndefined();
  });
});

describe("filterMentionNodes", () => {
  it("filters by name", () => {
    const nodes = [
      { id: "n1", name: "猫图", type: "ai-image" },
      { id: "n2", name: "文案", type: "ai-text" },
    ];
    expect(filterMentionNodes(nodes, "猫").map((node) => node.id)).toEqual([
      "n1",
    ]);
  });
});

describe("insertMention", () => {
  it("replaces the @query with the node name", () => {
    expect(insertMention("看 @猫", 4, { start: 2, query: "猫" }, {
      id: "n1",
      name: "猫图",
      type: "ai-image",
    })).toEqual({
      text: "看 @猫图 ",
      caret: 6,
    });
  });
});
