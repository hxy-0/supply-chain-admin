import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import dayjs from "dayjs";

test("seven-day navigation moves exactly seven days across year boundaries", async () => {
  const page = await readFile(
    new URL("../src/views/tms/dispatch/index.vue", import.meta.url),
    "utf8"
  );
  const moveSource = page.match(
    /function moveRange\(delta: number\) \{[\s\S]*?\n\}/
  )[0];
  const javascript = ts.transpileModule(moveSource, {}).outputText;
  const anchor = { value: "2027-01-03" };
  const move = new Function(
    "anchor",
    "dayjs",
    `${javascript}; return moveRange;`
  )(anchor, dayjs);
  move(-7);
  assert.equal(anchor.value, "2026-12-27");
  move(7);
  assert.equal(anchor.value, "2027-01-03");
});
const source = await readFile(
  new URL("../src/views/tms/dispatch/week.ts", import.meta.url),
  "utf8"
);
const javascript = ts
  .transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  })
  .outputText.replace(
    'from "dayjs"',
    `from ${JSON.stringify(import.meta.resolve("dayjs"))}`
  );
const { rangeDays, slotShifts, validateStops } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);

test("seven-day range starts on the selected day across year boundaries", () => {
  const days = rangeDays("2026-12-30");
  assert.equal(days[0].date, "2026-12-30");
  assert.equal(days[6].date, "2027-01-05");
  assert.deepEqual(
    days.map(day => day.label),
    ["周三", "周四", "周五", "周六", "周日", "周一", "周二"]
  );
  assert.throws(() => rangeDays("invalid"));
});
test("time slots retain multiple shifts and cancelled rows on the same date", () => {
  const rows = slotShifts(
    [
      {
        shiftId: "2",
        shiftNo: "B",
        templateId: "T",
        shiftDate: "2026-10-12",
        status: 99,
        startArriveTime: dayjs("2026-10-12T08:00").valueOf()
      },
      {
        shiftId: "1",
        shiftNo: "A",
        templateId: "T",
        shiftDate: "2026-10-12",
        status: 10,
        startArriveTime: dayjs("2026-10-12T09:00").valueOf()
      },
      { shiftId: "3", shiftNo: "C", shiftDate: "2026-10-12", status: 10 }
    ],
    "2026-10-12",
    2
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map(shift => shift.shiftId),
    ["2", "1"]
  );
});
test("node edits keep chronology and reject missing or reversed times", () => {
  const nodes = [
    { nodeId: "A", planArriveTime: 0, planDepartTime: 100 },
    { nodeId: "B", planArriveTime: 200, planDepartTime: 300 }
  ];
  assert.equal(validateStops(nodes), "");
  assert.ok(validateStops(nodes.slice(0, 1)));
  assert.ok(
    validateStops([
      ...nodes,
      { nodeId: "C", planArriveTime: 250, planDepartTime: 400 }
    ])
  );
  assert.ok(validateStops([{ ...nodes[0], planArriveTime: null }, nodes[1]]));
  assert.ok(validateStops([nodes[0], { ...nodes[1], nodeId: "A" }]));
});
const calls = [];
globalThis.__shiftHttp = {
  request: async (method, url, options) => {
    calls.push({ method, url, ...options });
    return { code: 0, data: [] };
  }
};
const apiSource = (
  await readFile(new URL("../src/api/tmsShift.ts", import.meta.url), "utf8")
).replace(
  'import { http } from "@/utils/http";',
  "const http = globalThis.__shiftHttp;"
);
const apiJs = ts.transpileModule(apiSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const { shiftApi } = await import(
  `data:text/javascript;base64,${Buffer.from(apiJs).toString("base64")}`
);
test("weekly generation sends the selected Monday without a carrier, vehicle or driver", async () => {
  await shiftApi.generateWeek("2026-10-12");
  assert.deepEqual(calls.at(-1), {
    method: "post",
    url: "/api/shifts/generate-week",
    data: { weekStart: "2026-10-12" }
  });
  await shiftApi.week("2026-10-12");
  assert.equal(calls.at(-1).url, "/api/shifts/week");
});
