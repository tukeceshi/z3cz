import { describe, expect, it } from "vitest";

import { measureAutoTextareaHeight } from "./use-ai-text-output-scroll";

describe("measureAutoTextareaHeight", () => {
  it("measures from collapsed height, not stale inline height", () => {
    const scrollContainer = { clientHeight: 100 } as HTMLElement;
    const textarea = {
      scrollHeight: 3200,
      style: { height: "3200px" },
    } as HTMLTextAreaElement;

    Object.defineProperty(textarea, "scrollHeight", {
      get() {
        return this.style.height === "0px" ? 80 : 80;
      },
    });

    expect(measureAutoTextareaHeight(textarea, scrollContainer)).toBe(100);
    expect(textarea.style.height).toBe("100px");
  });

  it("re-measures when content expands after the first height pass", () => {
    const scrollContainer = { clientHeight: 100 } as HTMLElement;
    const textarea = {
      style: { height: "80px" },
    } as HTMLTextAreaElement;

    Object.defineProperty(textarea, "scrollHeight", {
      get() {
        if (this.style.height === "0px") return 120;
        if (this.style.height === "120px") return 150;
        return 150;
      },
    });

    expect(measureAutoTextareaHeight(textarea, scrollContainer)).toBe(150);
    expect(textarea.style.height).toBe("120px");
  });
});
