import { describe, expect, it } from "vitest";

import { sameGenerativeCardFit } from "./generative-card-error-block";

describe("sameGenerativeCardFit", () => {
  it("treats equal measurements as unchanged", () => {
    const fit = {
      visibleBodyLineCount: 2,
      truncateLastLine: true,
      truncateTitle: false,
    };
    expect(sameGenerativeCardFit(fit, { ...fit })).toBe(true);
  });

  it("detects a truncated title change", () => {
    expect(
      sameGenerativeCardFit(
        {
          visibleBodyLineCount: 0,
          truncateLastLine: false,
          truncateTitle: false,
        },
        {
          visibleBodyLineCount: 0,
          truncateLastLine: false,
          truncateTitle: true,
        }
      )
    ).toBe(false);
  });
});
