import { describe, expect, it } from "vitest";

import {
  isOfficialOrgModelEndpoint,
  rootDomainFromEndpointUrl,
} from "./official-model-endpoint-host";

describe("rootDomainFromEndpointUrl", () => {
  it("keeps the registrable domain", () => {
    expect(rootDomainFromEndpointUrl("https://api.deepseek.com")).toBe(
      "deepseek.com"
    );
    expect(
      rootDomainFromEndpointUrl("https://ark.cn-beijing.volces.com/api/v3")
    ).toBe("volces.com");
    expect(rootDomainFromEndpointUrl("https://api.moonshot.ai/v1")).toBe(
      "moonshot.ai"
    );
  });
});

describe("isOfficialOrgModelEndpoint", () => {
  it("treats aggregate as official", () => {
    expect(
      isOfficialOrgModelEndpoint({
        channelKind: "aggregate",
        baseUrl: "https://relay.example.com",
      })
    ).toBe(true);
  });

  it("matches single-model official hosts and rejects relays", () => {
    expect(
      isOfficialOrgModelEndpoint({
        channelKind: "api",
        baseUrl: "https://api.deepseek.com",
      })
    ).toBe(true);
    expect(
      isOfficialOrgModelEndpoint({
        channelKind: "api",
        baseUrl: "https://api.moonshot.cn/v1",
      })
    ).toBe(true);
    expect(
      isOfficialOrgModelEndpoint({
        channelKind: "api",
        baseUrl: "https://relay.example.com/v1",
      })
    ).toBe(false);
  });
});
