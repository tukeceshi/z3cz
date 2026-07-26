import assert from "node:assert/strict";
import test from "node:test";

import { authCookieSecure } from "./auth-cookie";

test("authCookieSecure follows WEB_HOST protocol", () => {
  assert.equal(authCookieSecure("http://z3cz.com"), false);
  assert.equal(authCookieSecure("https://z3cz.com"), true);
  assert.equal(authCookieSecure("http://localhost:3101"), false);
  assert.equal(authCookieSecure("https://localhost"), true);
});
