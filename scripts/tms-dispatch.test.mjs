import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const calls = [];
let response = { code: 0, data: {} };
globalThis.__dispatchTransport = {
  request: async (method, url, options) => {
    calls.push({ method, url, ...options });
    return response;
  }
};
const source = (
  await readFile(new URL("../src/api/tmsDispatch.ts", import.meta.url), "utf8")
).replace(
  'import { http } from "@/utils/http";',
  "const http = globalThis.__dispatchTransport;"
);
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext }
}).outputText;
const { dispatchApi } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
test("dispatch plan belongs to a shift and reserves containers separately", async () => {
  await dispatchApi.create({ shiftId: "S" });
  assert.equal(calls.at(-1).url, "/api/tms/dispatch-plans");
  assert.deepEqual(calls.at(-1).data, { shiftId: "S" });
  await dispatchApi.cargo("P/1", "T", ["C1", "C2"]);
  assert.equal(calls.at(-1).url, "/api/tms/dispatch-plans/P%2F1/cargo");
  assert.deepEqual(calls.at(-1).data.containerIds, ["C1", "C2"]);
  assert.equal(calls.at(-1).data.tripId, "T");
  await dispatchApi.issue("P");
  assert.equal(calls.at(-1).url, "/api/tms/dispatch-plans/P/issue");
});
test("vehicle details query the selected vehicle and requested page", async () => {
  await dispatchApi.vehicleTrips("V/1", 2);
  assert.equal(calls.at(-1).url, "/api/tms/vehicles/V%2F1/trips");
  assert.deepEqual(calls.at(-1).data, { pageNum: 2, pageSize: 10 });
});
test("unavailable cargo cannot be reported as successfully assigned", async () => {
  response = { code: 1, message: "容器已被其他车次占用" };
  await assert.rejects(dispatchApi.cargo("P", "T", ["C1"]), /容器已被其他车次占用/);
});
