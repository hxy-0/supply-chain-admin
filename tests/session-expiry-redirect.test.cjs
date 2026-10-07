const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function setup(fullPath, query = {}) {
  let destination;
  const router = {
    currentRoute: { value: { fullPath, query } },
    replace: target => {
      destination = target;
    }
  };
  const imports = {
    pinia: { defineStore: (_name, options) => options },
    "../utils": {
      router,
      routerArrays: [],
      resetRouter: () => {
        router.currentRoute.value = { fullPath: "/login", query: {} };
      },
      storageLocal: () => ({ getItem: () => null, removeItem() {} })
    },
    "@/api/user": {},
    "./multiTags": { useMultiTagsStoreHook: () => ({ handleTags() {} }) },
    "@/utils/auth": { removeToken() {}, userKey: "user-info" },
    "@/router/sessionRoute": {
      isRestorablePath: value =>
        typeof value === "string" &&
        value.startsWith("/") &&
        !value.startsWith("//") &&
        !value.startsWith("/login")
    }
  };
  const compiled = ts.transpileModule(
    fs.readFileSync(
      path.join(__dirname, "../src/store/modules/user.ts"),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022
      }
    }
  ).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    name => {
      assert.ok(imports[name], `unexpected import: ${name}`);
      return imports[name];
    },
    module,
    module.exports
  );
  return {
    logout: preserve =>
      module.exports.useUserStore.actions.logOut.call({}, preserve),
    get destination() {
      return destination;
    }
  };
}

test("session expiry preserves the current path, query and hash before resetting routes", () => {
  const state = setup("/pms/products?status=0#sku");
  state.logout(true);
  assert.deepEqual(state.destination, {
    path: "/login",
    query: { redirect: "/pms/products?status=0#sku" }
  });
});

test("repeated expiry on the login page keeps the original redirect", () => {
  const state = setup("/login?redirect=x", {
    redirect: "/pms/products?status=0"
  });
  state.logout(true);
  assert.equal(state.destination.query.redirect, "/pms/products?status=0");
});

test("manual logout and external redirects do not preserve a return destination", () => {
  const manual = setup("/pms/products");
  manual.logout(false);
  assert.deepEqual(manual.destination.query, {});
  const invalid = setup("/login", { redirect: "//example.com" });
  invalid.logout(true);
  assert.deepEqual(invalid.destination.query, {});
});
