import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createRouter, createMemoryHistory } from "vue-router";
import ts from "typescript";
const source = (
  await readFile(
    new URL("../src/router/modules/home.ts", import.meta.url),
    "utf8"
  )
)
  .replace('import { $t } from "@/plugins/i18n";', "const $t = value => value;")
  .replace('import { home } from "@/router/enums";', "const home = 0;")
  .replace("import.meta.env", '{ VITE_HIDE_HOME: "false" }');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext }
}).outputText;
const { default: home } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
function newRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        ...home,
        component: {},
        children: home.children.map(route => ({ ...route, component: {} }))
      },
      { path: "/tms/pickup", name: "TmsPickup", component: {} }
    ]
  });
}
test("pickup detail is a refreshable page inside the layout and returns to the list", async () => {
  const router = newRouter();
  await router.push({
    name: "TmsPickupDetail",
    params: { id: "1234567890123456789" }
  });
  const path = router.currentRoute.value.fullPath;
  assert.equal(router.currentRoute.value.params.id, "1234567890123456789");
  assert.equal(router.currentRoute.value.matched[0].name, "Home");
  assert.equal(router.currentRoute.value.meta.showLink, false);
  assert.equal(router.currentRoute.value.meta.activePath, "/tms/pickup");
  const refreshed = newRouter();
  await refreshed.push(path);
  assert.equal(refreshed.currentRoute.value.name, "TmsPickupDetail");
  assert.equal(refreshed.currentRoute.value.params.id, "1234567890123456789");
  await refreshed.push("/tms/pickup");
  assert.equal(refreshed.currentRoute.value.name, "TmsPickup");
});
