import { describe, expect, it } from "vitest";

import type { Bindings } from "../context";
import { disconnectedUpdateStatus } from "./system-update-status";

function env(values: Partial<Bindings>): Bindings {
  return values as Bindings;
}

describe("disconnectedUpdateStatus", () => {
  it("does not present a local Node development server as update capable", () => {
    const status = disconnectedUpdateStatus(env({ RUNTIME: "node" }));

    expect(status.supported).toBe(false);
    expect(status.connected).toBe(false);
    expect(status.deployment).toBe("local-development");
  });

  it("keeps a configured self-host updater supported while disconnected", () => {
    const status = disconnectedUpdateStatus(
      env({
        RUNTIME: "node",
        UPDATER_SOCKET: "/run/z3cz-updater/updater.sock",
        UPDATER_TOKEN: "configured-token",
      })
    );

    expect(status.supported).toBe(true);
    expect(status.connected).toBe(false);
  });
});
