import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

// 在内存中执行后端的原始 CASE，覆盖分批及中转事实；不连接业务数据库。
const migration = readFileSync(
  new URL(
    "../../db/postgresql/migrations/20261011_order_batch_trip.sql",
    import.meta.url
  ),
  "utf8"
);
const expression = migration.match(
  /SELECT (CASE[\s\S]*?END) INTO resolved_status/
)[1];

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE tms_order (order_id TEXT, status TEXT, destination_node_id TEXT);
    CREATE TABLE tms_order_item (order_item_id TEXT, order_id TEXT, ordered_quantity NUMERIC, is_deleted INTEGER);
    CREATE TABLE tms_order_completion (order_item_id TEXT, quantity NUMERIC);
    CREATE TABLE tms_container_item (container_item_id TEXT, container_id TEXT, order_item_id TEXT, quantity NUMERIC);
    CREATE TABLE tms_container (container_id TEXT, status TEXT);
    CREATE TABLE tms_pickup_receipt (container_item_id TEXT);
    CREATE TABLE tms_trip_container (container_id TEXT, unload_stop_id TEXT, trip_id TEXT, status TEXT);
    CREATE TABLE tms_trip_stop (stop_id TEXT, trip_id TEXT, node_id TEXT, arrived_time INTEGER);
    INSERT INTO tms_order VALUES ('O', 'EXECUTING', 'D');
    INSERT INTO tms_order_item VALUES ('A', 'O', 10, 0), ('B', 'O', 5, 0);
  `);
  return db;
}
const status = db =>
  db.prepare(`SELECT ${expression} AS status FROM tms_order`).get().status;

test("creating tasks does not start transport; the first actual pickup does", () => {
  const db = fixture();
  assert.equal(status(db), "PENDING");
  db.exec(
    "INSERT INTO tms_container_item VALUES ('CA', 'C1', 'A', 10); INSERT INTO tms_pickup_receipt VALUES ('CA');"
  );
  assert.equal(status(db), "EXECUTING");
  db.close();
});

test("all lines must arrive at the final destination, and all must finish unloading", () => {
  const db = fixture();
  db.exec(`
    INSERT INTO tms_container_item VALUES ('CA', 'C1', 'A', 10), ('CB', 'C2', 'B', 5);
    INSERT INTO tms_pickup_receipt VALUES ('CA'), ('CB');
    INSERT INTO tms_container VALUES ('C1', 'ARRIVED'), ('C2', 'ARRIVED');
    INSERT INTO tms_trip_container VALUES ('C1', 'S1', 'T', 'LOADED'), ('C2', 'S2', 'T', 'LOADED');
    INSERT INTO tms_trip_stop VALUES ('S1', 'T', 'D', 1), ('S2', 'T', 'TRANSFER', 1);
  `);
  assert.equal(status(db), "EXECUTING");
  db.exec("UPDATE tms_trip_stop SET node_id = 'D' WHERE stop_id = 'S2';");
  assert.equal(status(db), "DELIVERED");
  db.exec("INSERT INTO tms_order_completion VALUES ('A', 10);");
  assert.equal(status(db), "DELIVERED");
  db.exec("INSERT INTO tms_order_completion VALUES ('B', 5);");
  assert.equal(status(db), "COMPLETED");
  db.exec("UPDATE tms_order SET status = 'CANCELLED';");
  assert.equal(status(db), "CANCELLED");
  db.close();
});

test("duplicate trip history cannot inflate arrived quantity; empty orders do not complete", () => {
  const db = fixture();
  db.exec(`
    INSERT INTO tms_container_item VALUES ('CA', 'C1', 'A', 5);
    INSERT INTO tms_pickup_receipt VALUES ('CA');
    INSERT INTO tms_trip_container VALUES ('C1', 'S', 'T', 'UNLOADED'), ('C1', 'S', 'T', 'LOADED');
    INSERT INTO tms_trip_stop VALUES ('S', 'T', 'D', 1);
  `);
  assert.equal(status(db), "EXECUTING");
  db.exec("DELETE FROM tms_order_item;");
  assert.equal(status(db), "PENDING");
  db.close();
});
