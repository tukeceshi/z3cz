import { describe, expect, it } from "vitest";

import {
  PERSIST_WORKER_INSTALL_DIR,
  buildPersistWorkerInstallScript,
  derivePersistWorkerApiBaseUrlFromWebHost,
  isLoopbackPersistWorkerApiBaseUrl,
} from "./persist-worker-install-script";

const params = {
  workerId: "worker-1",
  workerSecret: "secret-value",
  apiBaseUrl: "https://api.example.com",
  sshPassword: "ssh-pass",
  forwardHmacKey: "hmac-key",
} as const;

describe("buildPersistWorkerInstallScript", () => {
  it("stages files then elevates before creating /opt", () => {
    const script = buildPersistWorkerInstallScript(
      params,
      "export default {};\n"
    );

    const mkdirIndex = script.indexOf(`mkdir -p "$INSTALL_DIR"`);
    const installShIndex = script.indexOf('cat > "$STAGE_DIR/install.sh"');
    const sudoIndex = script.indexOf("sudo -n bash");
    const passwordSudoIndex = script.indexOf("sudo -S");

    expect(mkdirIndex).toBeGreaterThan(installShIndex);
    expect(sudoIndex).toBeGreaterThan(mkdirIndex);
    expect(passwordSudoIndex).toBeGreaterThan(sudoIndex);
    expect(script).toContain("FORWARD_PORT=3103");
    expect(script).toContain("FORWARD_HMAC_KEY=hmac-key");
    expect(script).toContain("export default {};");
    expect(script.includes(`mkdir -p ${PERSIST_WORKER_INSTALL_DIR}`)).toBe(
      false
    );
  });

  it("quotes sudo passwords that contain single quotes", () => {
    const script = buildPersistWorkerInstallScript(
      { ...params, sshPassword: "p'ass" },
      "void 0"
    );

    expect(script).toContain("SUDO_PASSWORD='p'\\''ass'");
  });

  it("warns when the worker API URL is loopback", () => {
    const script = buildPersistWorkerInstallScript(
      { ...params, apiBaseUrl: "http://localhost:3101/api" },
      "void 0"
    );

    expect(script).toContain("WARNING: API_BASE_URL points at localhost");
  });
});

describe("derivePersistWorkerApiBaseUrlFromWebHost", () => {
  it("appends /api so Caddy/Vite can proxy to the API", () => {
    expect(
      derivePersistWorkerApiBaseUrlFromWebHost("http://localhost:3101")
    ).toBe("http://localhost:3101/api");
    expect(
      derivePersistWorkerApiBaseUrlFromWebHost("https://app.example.com/api")
    ).toBe("https://app.example.com/api");
  });
});

describe("isLoopbackPersistWorkerApiBaseUrl", () => {
  it("detects localhost API URLs", () => {
    expect(isLoopbackPersistWorkerApiBaseUrl("http://localhost:3101/api")).toBe(
      true
    );
    expect(isLoopbackPersistWorkerApiBaseUrl("https://app.example.com/api")).toBe(
      false
    );
  });
});
