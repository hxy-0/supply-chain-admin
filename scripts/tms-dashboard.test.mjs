import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { buildRoutePoints } from "../src/views/tms/dispatch/routePoints.ts";

async function moduleFrom(source) {
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText;
  return import(
    "data:text/javascript;base64," + Buffer.from(javascript).toString("base64")
  );
}
globalThis.__overviewDefinitions = await moduleFrom(
  await readFile(
    new URL("../src/views/tms/fleet/definitions.ts", import.meta.url),
    "utf8"
  )
);
const source = (
  await readFile(
    new URL("../src/views/tms/monitoring/overview.ts", import.meta.url),
    "utf8"
  )
).replace(
  'import { enumCode, vehicleStatuses } from "../fleet/definitions";',
  "const { enumCode, vehicleStatuses } = globalThis.__overviewDefinitions;"
);
const { fleetOverview } = await moduleFrom(source);

test("fleet dashboard counts distinct telemetry vehicles and keeps status meanings separate", () => {
  const result = fleetOverview(
    [
      { id: "V1", status: "NORMAL", inspectionExpiryDate: "2026-10-10" },
      { id: "V2", status: 1, insuranceExpiryDate: "2026-10-12" }
    ],
    [
      { vehicleId: "V1", speedKph: 0 },
      { vehicleId: "V1", speedKph: 0 },
      { vehicleId: "V2", speedKph: 12 }
    ],
    "2026-10-11"
  );
  assert.equal(result.total, 2);
  assert.equal(result.online, 2);
  assert.equal(result.moving, 1);
  assert.equal(result.maintenance, 1);
  assert.equal(result.reminders.length, 1);
  assert.equal(result.reminders[0].vehicleId, "V1");
  assert.equal(fleetOverview([], [], "2026-10-11").online, 0);
});

test("route map keeps business sequence and filters failed or invalid coordinates", () => {
  const stops = [
    { nodeId: "N1", nodeName: "起点", stopSeq: 1 },
    { nodeId: "N2", nodeName: "中转", stopSeq: 2 },
    { nodeId: "N3", nodeName: "终点", stopSeq: 3 }
  ];
  const results = [
    { status: "fulfilled", value: { longitude: 113.2, latitude: 23.1 } },
    { status: "rejected", reason: new Error("无权限") },
    { status: "fulfilled", value: { longitude: 181, latitude: 20 } }
  ];
  const points = buildRoutePoints(stops, results);
  assert.equal(points.length, 1);
  assert.equal(points[0].nodeId, "N1");
  assert.equal(points[0].label, "1 · 起点");
  assert.deepEqual(buildRoutePoints([], []), []);
  assert.equal(
    buildRoutePoints(
      [stops[0]],
      [{ status: "fulfilled", value: { longitude: NaN, latitude: 20 } }]
    ).length,
    0
  );
});
