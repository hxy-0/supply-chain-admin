import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parse, compileScript } from "@vue/compiler-sfc";
import { createSSRApp, h } from "vue";
import { renderToString } from "vue/server-renderer";
import ts from "typescript";

async function loadModule(source) {
  const javascript = ts
    .transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022
      }
    })
    .outputText.replace(
      /from ["'](vue(?:\/server-renderer)?|dayjs)["']/g,
      (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`
    );
  return import(
    "data:text/javascript;base64," + Buffer.from(javascript).toString("base64")
  );
}

globalThis.__fleetDefinitions = await loadModule(
  await readFile(
    new URL("../src/views/tms/fleet/definitions.ts", import.meta.url),
    "utf8"
  )
);
globalThis.__workspaceDates = await loadModule(
  await readFile(new URL("../src/utils/date.ts", import.meta.url), "utf8")
);
globalThis.__workspaceSchedule = await loadModule(
  await readFile(
    new URL("../src/views/tms/dispatch/schedule.ts", import.meta.url),
    "utf8"
  )
);

async function component(path) {
  const { descriptor } = parse(
    await readFile(new URL(path, import.meta.url), "utf8")
  );
  const script = compileScript(descriptor, {
    id: path,
    inlineTemplate: true,
    templateOptions: { ssr: true }
  });
  return (
    await loadModule(
      script.content
        .replace(
          /import\s*\{([^}]+)\}\s*from ["']\.\.\/definitions["'];/,
          (_, names) => `const { ${names} } = globalThis.__fleetDefinitions;`
        )
        .replace(
          'import { formatDateTime } from "@/utils/date";',
          "const { formatDateTime } = globalThis.__workspaceDates;"
        )
        .replace(
          'import { buildStopSchedule } from "../schedule";',
          "const { buildStopSchedule } = globalThis.__workspaceSchedule;"
        )
        .replace(
          'import PlanTimeline from "./PlanTimeline.vue";',
          "const PlanTimeline = globalThis.__workspaceTimeline;"
        )
        .replace(
          'import TaskRouteMap from "./TaskRouteMap.vue";',
          "const TaskRouteMap = { render: () => null };"
        )
    )
  ).default;
}

const VehicleWorkbench = await component(
  "../src/views/tms/fleet/components/VehicleWorkbench.vue"
);
const ContainerCargo = await component(
  "../src/components/Tms/ContainerCargo.vue"
);
globalThis.__workspaceTimeline = await component(
  "../src/views/tms/dispatch/components/PlanTimeline.vue"
);
const RouteWorkbench = await component(
  "../src/views/tms/dispatch/components/RouteWorkbench.vue"
);

async function render(component, props) {
  const app = createSSRApp({ render: () => h(component, props) });
  app.directive("loading", { getSSRProps: () => ({}) });
  for (const name of [
    "el-button",
    "el-empty",
    "el-tag",
    "el-descriptions",
    "el-descriptions-item",
    "el-table",
    "el-table-column",
    "el-tooltip"
  ]) {
    app.component(name, {
      props: ["description"],
      render() {
        return h("div", [this.description, this.$slots.default?.()]);
      }
    });
  }
  return renderToString(app);
}

test("vehicle selection initially shows the first real vehicle and preserves capacity units", async () => {
  const html = await render(VehicleWorkbench, {
    vehicles: [
      {
        id: "V1",
        plateNumber: "粤B12345",
        status: 0,
        loadCapacity: 0,
        volumeCapacity: 32,
        carrierId: "C1"
      }
    ],
    carriers: [{ id: "C1", name: "合作车队" }],
    loading: false
  });
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /粤B12345/);
  assert.match(html, /合作车队/);
  assert.match(html, /0 吨/);
  assert.match(html, /32 m³/);
});

test("empty fleet renders an empty state without a fictional vehicle", async () => {
  const html = await render(VehicleWorkbench, {
    vehicles: [],
    carriers: [],
    loading: false
  });
  assert.match(html, /暂无车辆/);
  assert.doesNotMatch(html, /车辆维护/);
});

test("container detail uses actual quantities without rounding or estimating capacity", async () => {
  const html = await render(ContainerCargo, {
    containers: [
      {
        containerId: "C1",
        containerCode: "箱001",
        status: "IN_TRANSIT",
        items: [
          {
            containerItemId: "I1",
            goodsName: "配件",
            quantity: "99999999999999.9999",
            unit: "件"
          }
        ]
      }
    ]
  });
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /在途/);
  assert.match(html, /99999999999999.9999 件/);
});

test("empty pickup renders no selected container detail", async () => {
  const html = await render(ContainerCargo, { containers: [] });
  assert.match(html, /尚无实提容器/);
  assert.doesNotMatch(html, /参考重量/);
});

test("route nodes follow business sequence and missing times remain unknown", async () => {
  const html = await render(RouteWorkbench, {
    tasks: [
      {
        pickupTaskId: "T1",
        taskNo: "任务001",
        contacts: [{ name: "提货员", phone: "13800000000" }],
        stops: [
          { stopId: "S2", stopSeq: 2, nodeName: "终点" },
          { stopId: "S1", stopSeq: 1, nodeName: "起点" }
        ],
        items: []
      }
    ]
  });
  assert.ok(html.indexOf("起点") < html.indexOf("终点"));
  assert.match(html, /计划到达：-/);
  assert.match(html, /任务001/);
});

test("vehicle detail has no vehicle picker and shows registered length", async () => {
  const html = await render(VehicleWorkbench, {
    vehicles: [
      {
        id: "V1",
        plateNumber: "粤B12345",
        vehicleType: "FLATBED",
        vehicleLength: 9.6
      }
    ],
    carriers: [],
    loading: false,
    detailOnly: true
  });
  assert.doesNotMatch(html, /aria-label="车辆选择"/);
  assert.match(html, /9.6 米/);
  assert.match(html, /平板车/);
});
