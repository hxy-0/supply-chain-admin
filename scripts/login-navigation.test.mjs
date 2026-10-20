import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRouter, createMemoryHistory } from "vue-router";
import { loginDestination, lastPageKey } from "../src/router/sessionRoute.ts";
import ts from "typescript";

const messages = [];
const saved = new Map();
let menuError;
let tokenRemoved = false;
const router = createRouter({
  history: createMemoryHistory(),
  routes: ["/login", "/welcome", "/tms/order"].map(path => ({
    path,
    name: path,
    component: {}
  }))
});
globalThis.__loginNavigation = {
  router,
  loginDestination,
  lastPageKey,
  http: {},
  setToken: () => {
    tokenRemoved = false;
  },
  removeToken: () => {
    tokenRemoved = true;
  },
  storageLocal: () => ({
    removeItem: key => saved.delete(key),
    getItem: key => saved.get(key)
  }),
  initRouter: async () => {
    if (menuError) throw menuError;
  },
  getTopMenu: () => ({ path: "/welcome" }),
  message: text => messages.push(text),
  transformI18n: text => text
};
const source = (
  await readFile(
    new URL("../src/views/login/utils/authentication.ts", import.meta.url),
    "utf8"
  )
).replace(/import[\s\S]*?from ["'][^"']+["'];/g, "");
const javascript = ts.transpileModule(
  "const {router,loginDestination,lastPageKey,http,setToken,removeToken,storageLocal,initRouter,getTopMenu,message,transformI18n} = globalThis.__loginNavigation;\n" +
    source,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText;
const { completeLogin } = await import(
  "data:text/javascript;base64," + Buffer.from(javascript).toString("base64")
);

test("successful login actually navigates to the saved page before reporting success", async () => {
  await router.replace("/login");
  saved.set(lastPageKey("tester"), "/tms/order?page=2");
  await completeLogin({ username: "tester" });
  assert.equal(router.currentRoute.value.fullPath, "/tms/order?page=2");
  assert.equal(messages.at(-1), "login.pureLoginSuccess");
});

test("aborted navigation remains on login and cannot report login success", async () => {
  await router.replace("/login");
  messages.length = 0;
  const removeGuard = router.beforeEach(to => to.path === "/login");
  try {
    await assert.rejects(
      completeLogin({ username: "tester" }),
      /页面跳转未完成/
    );
    assert.equal(router.currentRoute.value.path, "/login");
    assert.equal(messages.length, 0);
  } finally {
    removeGuard();
  }
});

test("menu service failures preserve authentication but never force a fallback page", async () => {
  menuError = new Error("后端不可用");
  await assert.rejects(completeLogin({ username: "tester" }), /菜单加载失败/);
  assert.equal(router.currentRoute.value.path, "/login");
  assert.equal(tokenRemoved, false);
  menuError = Object.assign(new Error("令牌无效"), {
    response: { status: 401 }
  });
  await assert.rejects(completeLogin({ username: "tester" }), /令牌无效/);
  assert.equal(tokenRemoved, true);
  menuError = undefined;
});
