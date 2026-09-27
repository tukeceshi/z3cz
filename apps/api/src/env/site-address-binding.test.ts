import { describe, expect, it } from "vitest";

import { readSiteAddressSetting } from "./site-address-binding";

describe("readSiteAddressSetting", () => {
  it("uses the unprefixed value when it is set", () => {
    expect(
      readSiteAddressSetting(
        {
          SITE_ADDRESS_SOCKET: "/run/plain.sock",
          Z3CZ_SITE_ADDRESS_SOCKET: "/run/prefixed.sock",
        },
        "SITE_ADDRESS_SOCKET"
      )
    ).toBe("/run/plain.sock");
  });

  it("falls back to the Z3CZ_ name written by the installer", () => {
    expect(
      readSiteAddressSetting(
        {
          Z3CZ_SITE_ADDRESS_TOKEN: "a".repeat(32),
        },
        "SITE_ADDRESS_TOKEN"
      )
    ).toBe("a".repeat(32));
  });

  it("ignores a blank unprefixed value", () => {
    expect(
      readSiteAddressSetting(
        {
          SITE_ADDRESS_SOCKET: "  ",
          Z3CZ_SITE_ADDRESS_SOCKET: "/run/z3cz-site/site.sock",
        },
        "SITE_ADDRESS_SOCKET"
      )
    ).toBe("/run/z3cz-site/site.sock");
  });

  it("returns undefined when neither name is set", () => {
    expect(readSiteAddressSetting({}, "SITE_ADDRESS_SOCKET")).toBeUndefined();
  });
});
