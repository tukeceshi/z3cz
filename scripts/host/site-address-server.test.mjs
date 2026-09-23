import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  applySiteAddressEnv,
  createSiteAddressServer,
  ensureSiteAddressAccess,
  isSiteAddressApplied,
  normalizeSiteAddress,
  siteAddressStatus,
} from "./site-address-server.mjs";

const token = "a".repeat(32);

test("normalizeSiteAddress accepts a public hostname and HTTP init", () => {
  assert.equal(normalizeSiteAddress(""), ":80");
  assert.equal(normalizeSiteAddress("   "), ":80");
  assert.equal(normalizeSiteAddress(":80"), ":80");
  assert.equal(normalizeSiteAddress("Example.COM"), "example.com");
  assert.equal(normalizeSiteAddress("https://Example.COM/"), "example.com");
  assert.equal(normalizeSiteAddress("http://example.com"), "example.com");
  assert.equal(normalizeSiteAddress("example.com."), "example.com");
  assert.equal(
    normalizeSiteAddress("my-site.example.co.uk"),
    "my-site.example.co.uk"
  );
});

test("normalizeSiteAddress rejects local names, IPs, ports, and paths", () => {
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
    assert.throws(() => normalizeSiteAddress(input), undefined, input);
  }
});

test("applySiteAddressEnv writes the public origin and can clear it", () => {
  const bound = applySiteAddressEnv(
    "NODE_ENV=production\nZ3CZ_SITE_ADDRESS=:80\nJWT_SECRET=keep\n",
    "example.com"
  );
  assert.match(bound, /^Z3CZ_SITE_ADDRESS=example.com$/m);
  assert.match(bound, /^WEB_HOST=https:\/\/example.com$/m);
  assert.match(bound, /^WEBSITE_URL=https:\/\/example.com$/m);
  assert.match(bound, /^JWT_SECRET=keep$/m);
  assert.equal(isSiteAddressApplied(bound, "example.com"), true);

  const cleared = applySiteAddressEnv(bound, ":80");
  assert.match(cleared, /^Z3CZ_SITE_ADDRESS=:80$/m);
  assert.doesNotMatch(cleared, /^WEB_HOST=/m);
  assert.doesNotMatch(cleared, /^WEBSITE_URL=/m);
  assert.equal(siteAddressStatus(cleared, null).httpOnly, true);
  assert.equal(siteAddressStatus(cleared, null).siteAddress, null);
});

test("ensureSiteAddressAccess appends a token once", () => {
  const first = ensureSiteAddressAccess("NODE_ENV=production\n", () => token);
  assert.equal(first.changed, true);
  assert.match(
    first.content,
    new RegExp(`^Z3CZ_SITE_ADDRESS_TOKEN=${token}$`, "m")
  );
  const second = ensureSiteAddressAccess(first.content, () => "other");
  assert.equal(second.changed, false);
  assert.equal(second.content, first.content);
});

test("site address server saves then asks the host to recreate api and caddy", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "z3cz-site-"));
  const envFile = path.join(dir, "z3cz.env");
  const socketPath =
    process.platform === "win32"
      ? `\\\\.\\pipe\\z3cz-site-${process.pid}`
      : path.join(dir, "site.sock");
  fs.writeFileSync(
    envFile,
    `Z3CZ_SITE_ADDRESS=:80\nZ3CZ_SITE_ADDRESS_TOKEN=${token}\nZ3CZ_SITE_ADDRESS_SOCKET=/run/z3cz-site/site.sock\n`
  );
  let applyError = null;
  let composed = 0;
  const server = createSiteAddressServer({
    envFile,
    readToken: () => token,
    readApplyError: () => applyError,
    writeApplyError: (message) => {
      applyError = message;
    },
    runCompose: async () => {
      composed += 1;
    },
  });
  await new Promise((resolve) => {
    server.listen(socketPath, resolve);
  });
  try {
    const saved = await request(socketPath, "POST", {
      siteAddress: "https://Example.COM/",
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.restarting, true);
    assert.equal(saved.body.siteAddress, "example.com");
    assert.equal(composed, 1);
    assert.match(
      fs.readFileSync(envFile, "utf8"),
      /^WEB_HOST=https:\/\/example.com$/m
    );

    const same = await request(socketPath, "POST", {
      siteAddress: "example.com",
    });
    assert.equal(same.body.restarting, false);
    assert.equal(composed, 1);

    const rejected = await request(socketPath, "POST", {
      siteAddress: "localhost",
    });
    assert.equal(rejected.status, 400);
    assert.equal(rejected.body.code, "local_name");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function request(socketPath, method, body) {
  const payload = body ? JSON.stringify(body) : undefined;
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        path: "/v1/site-address",
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(payload
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload),
              }
            : {}),
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
          });
        });
      }
    );
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}
