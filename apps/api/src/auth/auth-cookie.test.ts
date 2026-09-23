import { describe, expect, it } from "vitest";

import {
  configuredPublicOrigin,
  resolveAuthCookieScope,
} from "./auth-cookie";

describe("configuredPublicOrigin", () => {
  it("ignores empty, loopback, and IP site URLs", () => {
    expect(configuredPublicOrigin(undefined)).toBeUndefined();
    expect(configuredPublicOrigin("")).toBeUndefined();
    expect(configuredPublicOrigin("http://localhost")).toBeUndefined();
    expect(configuredPublicOrigin("http://127.0.0.1")).toBeUndefined();
    expect(configuredPublicOrigin("http://172.24.214.196")).toBeUndefined();
  });

  it("keeps a configured domain", () => {
    expect(configuredPublicOrigin("https://app.example.com/")).toBe(
      "https://app.example.com"
    );
  });
});

describe("resolveAuthCookieScope", () => {
  it("follows the request when no domain is configured", () => {
    expect(
      resolveAuthCookieScope({
        configuredWebHost: "http://172.24.214.196",
        requestHttps: false,
      })
    ).toEqual({ secure: false });
    expect(
      resolveAuthCookieScope({
        configuredWebHost: "",
        requestHttps: true,
      })
    ).toEqual({ secure: true });
  });

  it("sets the registrable domain for a public HTTPS host", () => {
    expect(
      resolveAuthCookieScope({
        configuredWebHost: "https://app.example.com",
        requestHttps: true,
      })
    ).toEqual({
      domain: "example.com",
      secure: true,
    });
  });
});
