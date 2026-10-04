import assert from "node:assert/strict";
import { test } from "node:test";
import { loginDestination, isRestorablePath, lastPageKey } from "../src/router/sessionRoute.ts";

test("reopening restores the previous page and preserves query parameters", () => {
  assert.equal(loginDestination(undefined, "/pms/products?status=0"), "/pms/products?status=0");
});
test("explicit login return path takes precedence over the saved page", () => {
  assert.equal(loginDestination("/tms/fleet/driver", "/pms/products"), "/tms/fleet/driver");
});
test("auth, external and invalid destinations cannot be restored", () => {
  for (const path of ["/login", "/oauth/callback?code=x", "//example.com", "/\\example.com", "https://example.com", null, "/"]) {
    assert.equal(isRestorablePath(path), false);
    assert.equal(loginDestination(path, path), "/welcome");
  }
});
test("different accounts have different saved page keys", () => {
  assert.notEqual(lastPageKey("admin"), lastPageKey("common"));
});
