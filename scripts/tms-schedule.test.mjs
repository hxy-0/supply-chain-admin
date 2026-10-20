import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStopSchedule } from "../src/views/tms/dispatch/schedule.ts";

const task = stops => ({ pickupTaskId: "T1", taskNo: "任务001", stops });

test("timeline uses actual times, orders stops and never mutates source", () => {
  const stops = [
    {
      stopId: "S2",
      stopSeq: 2,
      plannedArrivalTime: 2000,
      plannedDepartureTime: 3000
    },
    {
      stopId: "S1",
      stopSeq: 1,
      plannedArrivalTime: 1000,
      plannedDepartureTime: 2000
    }
  ];
  const result = buildStopSchedule([task(stops)]);
  assert.equal(result.start, 1000);
  assert.equal(result.end, 3000);
  assert.equal(result.rows[0].id, "S1");
  assert.equal(result.rows[0].left, 0);
  assert.equal(result.rows[0].width, 50);
  assert.equal(result.rows[1].left, 50);
  assert.equal(stops[0].stopId, "S2");
});

test("single times are milestones and missing times do not create fictional durations", () => {
  const result = buildStopSchedule([
    task([
      { stopId: "S1", stopSeq: 1, plannedArrivalTime: 1000 },
      { stopId: "S2", stopSeq: 2 }
    ])
  ]);
  assert.equal(result.rows[0].width, 0);
  assert.equal(result.rows[0].left, 0);
  assert.equal(result.rows[1].left, undefined);
  assert.ok(Number.isFinite(result.rows[0].left));
});

test("reversed and invalid times cannot produce negative or NaN bars", () => {
  const result = buildStopSchedule([
    task([
      {
        stopId: "S1",
        stopSeq: 1,
        plannedArrivalTime: 3000,
        plannedDepartureTime: 1000
      },
      { stopId: "S2", stopSeq: 2, plannedArrivalTime: NaN }
    ])
  ]);
  assert.equal(result.rows[0].invalid, true);
  assert.equal(result.rows[0].left, undefined);
  assert.equal(result.start, undefined);
  assert.equal(result.rows[1].left, undefined);
  assert.deepEqual(buildStopSchedule([]).rows, []);
});
