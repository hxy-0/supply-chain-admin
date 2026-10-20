import type { PickupTask } from "@/api/tmsPickup";

export function buildStopSchedule(tasks: PickupTask[]) {
  const rows = tasks.flatMap(task =>
    [...task.stops]
      .sort((left, right) => left.stopSeq - right.stopSeq)
      .map(stop => {
        const arrival =
          Number.isFinite(stop.plannedArrivalTime) &&
          stop.plannedArrivalTime > 0
            ? stop.plannedArrivalTime
            : undefined;
        const departure =
          Number.isFinite(stop.plannedDepartureTime) &&
          stop.plannedDepartureTime > 0
            ? stop.plannedDepartureTime
            : undefined;
        return {
          id: stop.stopId,
          taskId: task.pickupTaskId,
          taskNo: task.taskNo,
          nodeName: stop.nodeName,
          arrival,
          departure,
          invalid:
            arrival !== undefined &&
            departure !== undefined &&
            departure < arrival
        };
      })
  );
  const times = rows
    .filter(row => !row.invalid)
    .flatMap(row =>
      [row.arrival, row.departure].filter(
        (time): time is number => time !== undefined
      )
    );
  if (!times.length)
    return {
      start: undefined,
      end: undefined,
      rows: rows.map(row => ({ ...row, left: undefined, width: undefined }))
    };
  const start = Math.min(...times);
  const end = Math.max(...times);
  const span = end - start || 1;
  return {
    start,
    end,
    rows: rows.map(row => ({
      ...row,
      left:
        row.invalid ||
        (row.arrival === undefined && row.departure === undefined)
          ? undefined
          : (((row.arrival ?? row.departure) - start) / span) * 100,
      width:
        row.arrival !== undefined && row.departure !== undefined && !row.invalid
          ? ((row.departure - row.arrival) / span) * 100
          : 0
    }))
  };
}
