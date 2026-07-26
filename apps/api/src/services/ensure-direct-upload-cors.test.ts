import { describe, expect, it } from "vitest";

import type { TosCorsRule } from "../integrations/volcengine/tos-sdk-cors";
import {
  corsRulesAllowDirectUpload,
} from "./ensure-direct-upload-cors";

describe("ensure-direct-upload-cors", () => {
  it("detects missing browser upload origins", () => {
    const rules: TosCorsRule[] = [
      {
        allowedOrigins: ["https://other.example"],
        allowedMethods: ["PUT"],
        allowedHeaders: ["*"],
        exposeHeaders: ["ETag"],
        maxAgeSeconds: 3600,
      },
    ];

    expect(
      corsRulesAllowDirectUpload(rules, ["http://localhost:3101"])
    ).toBe(false);
  });

  it("accepts wildcard origins for direct upload", () => {
    const rules: TosCorsRule[] = [
      {
        allowedOrigins: ["*"],
        allowedMethods: ["PUT"],
        allowedHeaders: ["*"],
        exposeHeaders: ["ETag"],
        maxAgeSeconds: 3600,
      },
    ];

    expect(
      corsRulesAllowDirectUpload(rules, ["http://localhost:3101"])
    ).toBe(true);
  });
});
