import { describe, expect, it } from "vitest";

import { workflowPublicStateFromSiteSettings } from "./workflow-public-state";

describe("workflow-public-state", () => {
  it("maps site settings maintenance fields", () => {
    expect(
      workflowPublicStateFromSiteSettings({
        maintenanceEnabled: true,
        maintenanceMessage: "维护中",
      })
    ).toEqual({
      maintenanceEnabled: true,
      maintenanceMessage: "维护中",
    });
  });
});
