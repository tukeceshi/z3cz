import { describe, expect, it } from "vitest";

import {
  beginGenerativeMediaWork,
  isGenerativeMediaWorkActive,
} from "./generative-media-active-work";

describe("generative-media-active-work", () => {
  it("tracks nested active sessions", () => {
    expect(isGenerativeMediaWorkActive()).toBe(false);
    const endFirst = beginGenerativeMediaWork();
    expect(isGenerativeMediaWorkActive()).toBe(true);
    const endSecond = beginGenerativeMediaWork();
    endFirst();
    expect(isGenerativeMediaWorkActive()).toBe(true);
    endSecond();
    expect(isGenerativeMediaWorkActive()).toBe(false);
  });
});
