import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAppYml,
  stringifyAppYml,
} from "../lib/parse-app-yml.mjs";
import { publicOrigin, renderCaddyfile, renderCompose } from "../lib/render.mjs";

test("parseAppYml reads hostname https and env", () => {
  const config = parseAppYml(`
hostname: example.com
https: true
http_port: 80
https_port: 443
env:
  JWT_SECRET: abc
  SECRET_MASTER_KEY: def
  WEB_HOST: https://example.com
`);
  assert.equal(config.hostname, "example.com");
  assert.equal(config.https, true);
  assert.equal(config.env.JWT_SECRET, "abc");
  assert.equal(config.env.WEB_HOST, "https://example.com");
});

test("stringifyAppYml round-trip", () => {
  const yaml = stringifyAppYml({
    hostname: "localhost",
    https: false,
    tls: "auto",
    http_port: 8080,
    https_port: 443,
    env: {
      JWT_SECRET: "a".repeat(64),
      SECRET_MASTER_KEY: "b".repeat(64),
      WEB_HOST: "http://localhost:8080",
    },
  });
  const parsed = parseAppYml(yaml);
  assert.equal(parsed.hostname, "localhost");
  assert.equal(parsed.https, false);
  assert.equal(parsed.http_port, 8080);
  assert.equal(parsed.env.WEB_HOST, "http://localhost:8080");
});

test("publicOrigin includes non-default ports", () => {
  assert.equal(publicOrigin("localhost", false, 8080, 443), "http://localhost:8080");
  assert.equal(publicOrigin("ex.com", true, 80, 443), "https://ex.com");
});

test("parseAppYml reads tls field", () => {
  const config = parseAppYml(`
hostname: example.com
https: true
tls: manual
http_port: 80
https_port: 443
env:
  JWT_SECRET: abc
  SECRET_MASTER_KEY: def
`);
  assert.equal(config.tls, "manual");
});

test("parseAppYml defaults tls to auto", () => {
  const config = parseAppYml(`
hostname: example.com
https: true
env:
  JWT_SECRET: abc
  SECRET_MASTER_KEY: def
`);
  assert.equal(config.tls, "auto");
});

test("parseAppYml maps legacy acme to fallback", () => {
  const config = parseAppYml(`
hostname: example.com
https: true
tls: acme
env:
  JWT_SECRET: abc
  SECRET_MASTER_KEY: def
`);
  assert.equal(config.tls, "fallback");
});

test("renderCaddyfile manual tls uses unified cert paths", () => {
  const file = renderCaddyfile({
    hostname: "ex.com",
    https: true,
    tls: "manual",
    le_email: "",
    http_port: 80,
    https_port: 443,
    env: {},
    origin: "https://ex.com",
  });
  assert.match(file, /tls \/etc\/caddy\/certs\/ex\.com\/fullchain\.pem/);
});

test("renderCaddyfile fallback uses same cert paths as manual", () => {
  const file = renderCaddyfile({
    hostname: "ex.com",
    https: true,
    tls: "fallback",
    le_email: "",
    http_port: 80,
    https_port: 443,
    env: {},
    origin: "https://ex.com",
  });
  assert.match(file, /tls \/etc\/caddy\/certs\/ex\.com\/fullchain\.pem/);
});

test("renderCaddyfile auto has no tls line", () => {
  const file = renderCaddyfile({
    hostname: "ex.com",
    https: true,
    tls: "auto",
    le_email: "",
    http_port: 80,
    https_port: 443,
    env: {},
    origin: "https://ex.com",
  });
  assert.doesNotMatch(file, /^\ttls /m);
});

test("renderCaddyfile https disables http3 and clears alt-svc", () => {
  const file = renderCaddyfile({
    hostname: "ex.com",
    https: true,
    tls: "auto",
    le_email: "",
    http_port: 80,
    https_port: 443,
    env: {},
    origin: "https://ex.com",
  });
  assert.match(file, /protocols h1 h2/);
  assert.match(file, /header Alt-Svc "clear"/);
});

test("renderCompose does not expose udp 443", () => {
  const yaml = renderCompose({
    hostname: "ex.com",
    https: true,
    tls: "auto",
    le_email: "",
    http_port: 80,
    https_port: 443,
    env: {
      JWT_SECRET: "a".repeat(64),
      SECRET_MASTER_KEY: "b".repeat(64),
    },
    origin: "https://ex.com",
  });
  assert.doesNotMatch(yaml, /443\/udp/);
});

test("renderCompose file tls mounts unified cert dir", () => {
  const yaml = renderCompose({
    hostname: "ex.com",
    https: true,
    tls: "manual",
    le_email: "",
    http_port: 80,
    https_port: 443,
    env: {
      JWT_SECRET: "a".repeat(64),
      SECRET_MASTER_KEY: "b".repeat(64),
    },
    origin: "https://ex.com",
  });
  assert.match(yaml, /shared\/caddy\/certs:\/etc\/caddy\/certs:ro/);
});

test("renderCaddyfile http-only listens on :80", () => {
  const file = renderCaddyfile({
    hostname: "localhost",
    https: false,
    tls: "auto",
    le_email: "",
    http_port: 8080,
    https_port: 443,
    env: {},
    origin: "http://localhost:8080",
  });
  assert.match(file, /:80 \{/);
  assert.match(file, /handle_path \/api\/\*/);
  assert.match(file, /reverse_proxy api:3102/);
  assert.match(file, /reverse_proxy app:80/);
});

test("renderCompose is host project without smtp", () => {
  const yaml = renderCompose({
    hostname: "localhost",
    https: false,
    tls: "auto",
    le_email: "",
    http_port: 8080,
    https_port: 443,
    env: {
      JWT_SECRET: "a".repeat(64),
      SECRET_MASTER_KEY: "b".repeat(64),
    },
    origin: "http://localhost:8080",
  });
  assert.match(yaml, /name: dafthunk-host/);
  assert.match(yaml, /target: prod-api/);
  assert.match(yaml, /target: prod-app/);
  assert.match(yaml, /image: caddy:2\.9-alpine/);
  assert.doesNotMatch(yaml, /smtp/i);
  assert.doesNotMatch(yaml, /prod-www/);
  assert.match(yaml, /VITE_WS_VIA_PROXY: "1"/);
  assert.match(yaml, /app\.static\.conf/);
});
