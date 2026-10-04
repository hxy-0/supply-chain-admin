import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import {
  enumCode,
  optionLabel,
  driverStatuses,
  vehicleTypes,
  nodeTypes,
  definitions
} from "../src/views/tms/fleet/definitions.ts";

test("fleet enum values accept backend names and numeric codes without treating empty values as zero", () => {
  for (const value of [0, "0", "ENABLED"])
    assert.equal(enumCode(value, driverStatuses), 0);
  for (const value of [null, undefined, "", "UNKNOWN", -1]) {
    assert.equal(enumCode(value, driverStatuses), undefined);
    assert.equal(optionLabel(value, driverStatuses), "-");
  }
  assert.equal(enumCode("CONTAINER", vehicleTypes), 4);
  assert.equal(enumCode("DC_WAREHOUSE", nodeTypes), 1);
  assert.equal(enumCode("STATION", nodeTypes), 7);
});

test("every fleet filter has a form definition and defaults serialize to backend codes", () => {
  for (const def of Object.values(definitions)) {
    for (const filter of def.filters)
      assert.ok(def.fields.some(field => field.key === filter));
    for (const field of def.fields.filter(field => field.options)) {
      if (field.key in def.defaults)
        assert.equal(
          enumCode(def.defaults[field.key], field.options),
          def.defaults[field.key]
        );
    }
  }
});

// Replace only the transport to verify the real migrated API boundary without a running backend.
const calls = [];
let response;
globalThis.__tmsTransport = {
  request: async (method, url, options) => {
    calls.push({ method, url, ...options });
    return response;
  }
};
const source = (
  await readFile(new URL("../src/api/tms.ts", import.meta.url), "utf8")
).replace(
  'import { http } from "@/utils/http";',
  "const http = globalThis.__tmsTransport;"
);
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const api = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

test("queue API preserves status filters and normalizes enum names returned by the backend", async () => {
  response = {
    code: 0,
    data: {
      records: [
        { ticketId: "ticket", status: "CALLING" },
        { ticketId: "done", status: "40" }
      ],
      total: 2
    }
  };
  const result = await api.queueTicketApi.page({
    pageNum: 2,
    pageSize: 10,
    queueId: "scene",
    statuses: [20, 30]
  });
  assert.deepEqual(
    result.records.map(t => t.status),
    [20, 40]
  );
  assert.equal(calls.at(-1).url, "/api/queue/ticket/page");
  assert.deepEqual(calls.at(-1).data.statuses, [20, 30]);
  response = { code: 0, data: { records: [{ status: "DISABLED" }], total: 1 } };
  assert.equal(
    (await api.queueConfigApi.page({ pageNum: 1, pageSize: 10 })).records[0]
      .status,
    0
  );
});

test("call and complete operations retain resource assignment and automatic next ticket", async () => {
  response = { code: 0, data: { ticketId: "ticket", status: "CALLING" } };
  const ticket = await api.queueTicketApi.callNext("scene", "type", "dock");
  assert.equal(ticket.status, 20);
  assert.equal(calls.at(-1).url, "/api/queue/ticket/callNext/scene/type");
  assert.deepEqual(calls.at(-1).params, { resourceId: "dock" });
  response = {
    code: 0,
    data: { ticket: { status: "COMPLETED" }, nextTicket: { status: "CALLING" } }
  };
  const complete = await api.queueTicketApi.complete({
    ticketId: "ticket",
    resourceId: "dock",
    autoCallNext: true
  });
  assert.equal(complete.ticket.status, 40);
  assert.equal(complete.nextTicket.status, 20);
  assert.equal(calls.at(-1).data.autoCallNext, true);
});

test("track requests use automatic thinning by default and support explicit sampling", async () => {
  response = {
    code: 0,
    data: { locations: [], originalCount: 0, returnedCount: 0, sampled: false }
  };
  await api.vehicleTrackApi.track("vehicle", 1000, 2000);
  assert.deepEqual(calls.at(-1).params, {
    startTime: 1000,
    endTime: 2000,
    maxPoints: 0
  });
  await api.vehicleTrackApi.track("vehicle", 1000, 2000, 800);
  assert.equal(
    calls.at(-1).url,
    "/api/monitoring/vehicle-location/vehicle/vehicle/track"
  );
  assert.deepEqual(calls.at(-1).params, {
    startTime: 1000,
    endTime: 2000,
    maxPoints: 800
  });
});

test("backend validation failures reject rather than reporting a successful save", async () => {
  response = { code: 400, message: "前缀重复" };
  await assert.rejects(() => api.queueConfigApi.saveOrUpdate({}), /前缀重复/);
});
