import { describe, expect, it } from "vitest";

import {
  normalizeSiteAddress,
  SiteAddressValidationError,
} from "./site-address";

describe("normalizeSiteAddress", () => {
  it("accepts a public hostname and HTTP init", () => {
    expect(normalizeSiteAddress("")).toBe(":80");
    expect(normalizeSiteAddress("   ")).toBe(":80");
    expect(normalizeSiteAddress(":80")).toBe(":80");
    expect(normalizeSiteAddress("Example.COM")).toBe("example.com");
    expect(normalizeSiteAddress("https://Example.COM/")).toBe("example.com");
    expect(normalizeSiteAddress("http://example.com")).toBe("example.com");
    expect(normalizeSiteAddress("example.com.")).toBe("example.com");
    expect(normalizeSiteAddress("my-site.example.co.uk")).toBe(
      "my-site.example.co.uk"
    );
  });

  it("rejects local names, IPs, ports, and paths", () => {
    for (const input of [
      "localhost",
      "127.0.0.1",
      "1.2.3.4",
      "::1",
      "example.com:443",
      "https://example.com/path",
      "example",
      "*.example.com",
      "not a domain",
    ]) {
      expect(() => normalizeSiteAddress(input)).toThrow(
        SiteAddressValidationError
      );
    }
  });
});
