import { describe, expect, it } from "vitest";

import {
  buildR2CorsConfigurationXml,
  corsRulesAllowShellFetch,
  mergeShellFetchRule,
  parseR2CorsConfigurationXml,
  type R2CorsRule,
} from "./bootstrap-r2-cors";

describe("bootstrap-r2-cors", () => {
  it("builds and parses shell CORS configuration", () => {
    const rules: R2CorsRule[] = [
      {
        allowedOrigins: ["https://z3cz.com"],
        allowedMethods: ["GET", "HEAD"],
        allowedHeaders: ["*"],
        exposeHeaders: ["ETag", "Content-Length"],
        maxAgeSeconds: 3600,
      },
    ];

    const xml = buildR2CorsConfigurationXml(rules);
    const parsed = parseR2CorsConfigurationXml(xml);

    expect(parsed).toEqual(rules);
  });

  it("merges missing shell origins into an existing GET rule", () => {
    const existing: R2CorsRule[] = [
      {
        allowedOrigins: ["https://z3cz.com"],
        allowedMethods: ["GET"],
        allowedHeaders: ["*"],
        exposeHeaders: [],
        maxAgeSeconds: 600,
      },
    ];
    const shellRule: R2CorsRule = {
      allowedOrigins: ["http://localhost:3101"],
      allowedMethods: ["GET", "HEAD"],
      allowedHeaders: ["*"],
      exposeHeaders: ["ETag", "Content-Length"],
      maxAgeSeconds: 3600,
    };

    const merged = mergeShellFetchRule(existing, shellRule);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.allowedOrigins).toEqual([
      "https://z3cz.com",
      "http://localhost:3101",
    ]);
    expect(corsRulesAllowShellFetch(merged, shellRule.allowedOrigins)).toBe(
      true
    );
  });
});
