import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRouter, createMemoryHistory } from "vue-router";
import ts from "typescript";

const remainingSource = (
  await readFile(
    new URL("../src/router/modules/remaining.ts", import.meta.url),
    "utf8"
  )
).replace('import { $t } from "@/plugins/i18n";', "const $t = value => value;");
const javascript = ts.transpileModule(remainingSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext }
}).outputText;
const { default: remaining } = await import(
  "data:text/javascript;base64," + Buffer.from(javascript).toString("base64")
);
const indexSource = await readFile(
  new URL("../src/router/index.ts", import.meta.url),
  "utf8"
);
const normalizedIndex = indexSource.replaceAll("\r\n", "\n");
const start = normalizedIndex.indexOf(
  "    if (\n      usePermissionStoreHook().wholeMenus.length === 0"
);
const end = normalizedIndex.indexOf('    if (to.path === "/welcome"', start);
assert.ok(start >= 0 && end > start);
const initialize = new (async () => {}).constructor(
  "to",
  "router",
  "initRouter",
  "usePermissionStoreHook",
  "message",
  "NProgress",
  normalizedIndex.slice(start, end)
);

test("directories never render a descendant component through partial path matching", async () => {
  const source = await readFile(
    new URL("../src/router/utils.ts", import.meta.url),
    "utf8"
  );
  const start = source.indexOf("function addAsyncRoutes(");
  const end = source.indexOf("/** 获取路由历史模式", start);
  const body = ts.transpileModule(source.slice(start, end), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const panel = () => {};
  const template = () => {};
  const modules = {
    "/src/views/tms/dispatch/components/PlanPanel.vue": panel,
    "/src/views/tms/shift-template/index.vue": template
  };
  const resolve = new Function(
    "modulesRoutes",
    "IFrame",
    `${body}; return addAsyncRoutes;`
  )(modules, () => {});
  const routes = [
    {
      path: "/tms",
      meta: {},
      children: [
        {
          path: "/tms/fulfillment",
          meta: {},
          children: [
            {
              path: "/tms/shift-template",
              component: "tms/shift-template/index",
              meta: {},
              children: []
            }
          ]
        }
      ]
    }
  ];
  resolve(routes);
  assert.equal(routes[0].component, undefined);
  assert.equal(routes[0].children[0].component, undefined);
  assert.equal(routes[0].children[0].children[0].component, template);
});
test("direct dynamic-page navigation matches after menus load without unmatched warnings", async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: remaining.map(route => ({
        ...route,
        component: {},
        children: undefined
      }))
    });
    let loaded = false;
    router.beforeEach(to =>
      initialize(
        to,
        router,
        async () => {
          router.addRoute({
            path: "/system/user/index",
            name: "SystemUser",
            component: {}
          });
          loaded = true;
        },
        () => ({ wholeMenus: loaded ? [{}] : [] }),
        () => {},
        { done() {} }
      )
    );
    await router.push("/system/user/index");
    assert.equal(router.currentRoute.value.name, "SystemUser");
    await router.push("/nonexistent-page");
    assert.equal(router.currentRoute.value.name, "PageNotFound");
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = originalWarn;
  }
});
