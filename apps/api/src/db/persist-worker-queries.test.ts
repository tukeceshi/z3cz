import { describe, expect, it } from "vitest";

import {
  buildBootstrapPersistWorkerInput,
  persistWorkerServesOrganization,
} from "./persist-worker-queries";

describe("buildBootstrapPersistWorkerInput", () => {
  it("prefixes worker id with organization when adding for an org", () => {
    const result = buildBootstrapPersistWorkerInput(
      {
        name: "Tokyo",
        host: "203.0.113.10",
        sshUsername: "root",
        sshPassword: "secret",
      },
      "0192e5c8-aaaa-bbbb-cccc-ddddeeeeffff"
    );

    expect(result.host).toBe("203.0.113.10");
    expect(result.id.startsWith("0192e5c8aaaa-")).toBe(true);
    expect(result.id).toContain("203-0-113-10");
  });

  it("keeps host-based id when no organization is provided", () => {
    const result = buildBootstrapPersistWorkerInput({
      name: "Tokyo",
      host: "203.0.113.10",
      sshUsername: "root",
      sshPassword: "secret",
    });

    expect(result.id).toBe("203-0-113-10");
  });
});

describe("persistWorkerServesOrganization", () => {
  it("lets platform workers serve any organization", () => {
    expect(
      persistWorkerServesOrganization({ organizationId: null }, "org-a")
    ).toBe(true);
  });

  it("lets org workers serve only their organization", () => {
    expect(
      persistWorkerServesOrganization({ organizationId: "org-a" }, "org-a")
    ).toBe(true);
    expect(
      persistWorkerServesOrganization({ organizationId: "org-a" }, "org-b")
    ).toBe(false);
  });
});
