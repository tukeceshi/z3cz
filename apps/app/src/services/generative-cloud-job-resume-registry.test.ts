import { afterEach, describe, expect, it } from "vitest";

import {
  releaseGenerativeJobResume,
  resetGenerativeJobFinalizeClaimsForTests,
  resetGenerativeJobResumeClaimsForTests,
  tryClaimGenerativeJobFinalize,
  tryClaimGenerativeJobResume,
} from "./generative-cloud-job-resume-registry";

describe("tryClaimGenerativeJobFinalize", () => {
  afterEach(() => {
    resetGenerativeJobFinalizeClaimsForTests();
  });

  it("allows the first claim and rejects the second for the same job", () => {
    expect(tryClaimGenerativeJobFinalize("job-1")).toBe(true);
    expect(tryClaimGenerativeJobFinalize("job-1")).toBe(false);
  });

  it("allows empty job ids (sync / non-job path)", () => {
    expect(tryClaimGenerativeJobFinalize("")).toBe(true);
    expect(tryClaimGenerativeJobFinalize("   ")).toBe(true);
  });

  it("allows distinct job ids independently", () => {
    expect(tryClaimGenerativeJobFinalize("job-a")).toBe(true);
    expect(tryClaimGenerativeJobFinalize("job-b")).toBe(true);
  });
});

describe("tryClaimGenerativeJobResume", () => {
  afterEach(() => {
    resetGenerativeJobResumeClaimsForTests();
  });

  it("allows only one active resume claim per job", () => {
    expect(tryClaimGenerativeJobResume("job-1")).toBe(true);
    expect(tryClaimGenerativeJobResume("job-1")).toBe(false);
  });

  it("allows a new claim after release", () => {
    expect(tryClaimGenerativeJobResume("job-1")).toBe(true);
    releaseGenerativeJobResume("job-1");
    expect(tryClaimGenerativeJobResume("job-1")).toBe(true);
  });
});
