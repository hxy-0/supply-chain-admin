import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "..");
const evaluate = (file, modules) => {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    code,
    {
      exports,
      require: name => {
        if (name in modules) return modules[name];
        if (name.includes("?component")) return { default: () => null };
        throw new Error(`Unsupported import ${name} in ${file}`);
      },
      console,
      importMeta: { env: { VITE_HIDE_HOME: "false" } }
    },
    { timeout: 1000 }
  );
  return exports;
};
const enums = evaluate("src/router/enums.ts", {});
const modules = {
  "@/plugins/i18n": { $t: v => v },
  "@/router/enums": enums,
  "vite-plugin-fake-server/client": { defineFakeRoute: r => r }
};
const files = fs
  .readdirSync(path.join(root, "src/router/modules"))
  .filter(f => f.endsWith(".ts") && !["home.ts", "remaining.ts"].includes(f));
const routes = files.flatMap(
  file => evaluate(`src/router/modules/${file}`, modules).default
);
const asyncRoutes = evaluate(
  "mock/asyncRoutes.ts",
  modules
).default[0].response().data;
routes.push(...asyncRoutes);
const quote = value =>
  value == null ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
let sql = [
  "-- Generated from frontend route modules and asyncRoutes by scripts/export-rbac.mjs.",
  "-- Template menus are granted only to admin; common users start with the static home page.",
  "BEGIN;"
];
let count = 0,
  permissionCount = 0;
const seen = new Set(),
  seenNames = new Set(),
  permissions = new Set();
function append(route, parent = null) {
  if (seen.has(route.path)) throw new Error(`Duplicate route ${route.path}`);
  seen.add(route.path);
  count++;
  const meta = { ...(route.meta || {}) };
  const auths = Array.isArray(meta.auths) ? meta.auths : [];
  delete meta.auths;
  delete meta.roles;
  delete meta.title;
  delete meta.icon;
  delete meta.rank;
  delete meta.showLink;
  delete meta.keepAlive;
  delete meta.backstage;
  let component = typeof route.component === "string" ? route.component : null;
  if (typeof route.component === "function")
    component =
      route.component
        .toString()
        .match(/@\/views\/([^"']+)/)?.[1]
        ?.replace(/\.vue$/, "") ?? null;
  const kind = route.children?.length
    ? "DIRECTORY"
    : /^https?:\/\//.test(route.path)
      ? "EXTERNAL"
      : "PAGE";
  const routeName = route.name || `Menu${count}`;
  if (seenNames.has(routeName))
    throw new Error(`Duplicate route name ${routeName}`);
  seenNames.add(routeName);
  sql.push(
    `INSERT INTO sys_menu(parent_id,kind,title,route_path,route_name,component,redirect,icon,sort_order,visible,keep_alive,meta) VALUES (${parent ? `(SELECT menu_id FROM sys_menu WHERE route_path=${quote(parent)})` : "NULL"},${quote(kind)},${quote(route.meta?.title || routeName)},${quote(route.path)},${quote(routeName)},${quote(component)},${quote(route.redirect)},${quote(route.meta?.icon)},${route.meta?.rank || count},${route.meta?.showLink !== false},${route.meta?.keepAlive === true},${quote(JSON.stringify(meta))}::jsonb) ON CONFLICT(route_path) DO NOTHING;`
  );
  sql.push(
    `INSERT INTO sys_role_menu(role_id,menu_id) SELECT r.role_id,m.menu_id FROM sys_role r CROSS JOIN sys_menu m WHERE r.code='admin' AND m.route_path=${quote(route.path)} ON CONFLICT DO NOTHING;`
  );
  for (const code of auths) {
    if (code === "*:*:*") continue;
    if (!permissions.has(code)) {
      permissions.add(code);
      permissionCount++;
      sql.push(
        `INSERT INTO sys_permission(code,name) VALUES (${quote(code)},${quote(code)}) ON CONFLICT(code) DO NOTHING;`
      );
    }
    sql.push(
      `INSERT INTO sys_menu_permission(menu_id,permission_id) SELECT m.menu_id,p.permission_id FROM sys_menu m CROSS JOIN sys_permission p WHERE m.route_path=${quote(route.path)} AND p.code=${quote(code)} ON CONFLICT DO NOTHING;`
    );
    sql.push(
      `INSERT INTO sys_role_permission(role_id,permission_id) SELECT r.role_id,p.permission_id FROM sys_role r CROSS JOIN sys_permission p WHERE r.code='admin' AND p.code=${quote(code)} ON CONFLICT DO NOTHING;`
    );
  }
  for (const child of route.children || []) append(child, route.path);
}
for (const route of routes) append(route);
sql.push("COMMIT;", "");
const output = path.resolve(
  root,
  "../db/tms/postgresql/pure_admin_menu_seed.sql"
);
fs.writeFileSync(output, sql.join("\n"));
console.log(
  `Exported ${count} menus and ${permissionCount} permission codes to ${output}`
);
