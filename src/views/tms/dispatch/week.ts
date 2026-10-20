import dayjs from "dayjs";
import type { Shift } from "@/api/tmsShift";

/** 起始日（任意星期）起连续七天的列头 */
export function rangeDays(anchor: string) {
  const start = dayjs(anchor);
  if (!start.isValid()) throw new Error("请选择有效日期");
  return Array.from({ length: 7 }, (_, index) => {
    const date = start.add(index, "day");
    return {
      date: date.format("YYYY-MM-DD"),
      label: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
        date.day()
      ]
    };
  });
}

/** 每列纵向 6 个时间段（0:00-4:00、4:00-8:00、…、20:00-24:00） */
export const TIME_SLOTS = [0, 4, 8, 12, 16, 20];
export function slotLabel(slot: number): string {
  return `${slot * 4}:00-${slot * 4 + 4}:00`;
}

/** 班次起点（始发点）的到达时刻；优先取接口顶层 startArriveTime，跨天顺延后仍按其实际时刻归槽 */
export function shiftStartArrive(shift: Shift): number | null {
  const direct = Number(shift.startArriveTime);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const arrive = Number(shift.nodes?.[0]?.planArriveTime);
  if (!Number.isFinite(arrive) || arrive <= 0) return null;
  return arrive;
}
export function shiftStartSlot(shift: Shift): number {
  const arrive = shiftStartArrive(shift);
  if (arrive === null) return 0;
  return Math.min(5, Math.floor(dayjs(arrive).hour() / 4));
}
export function slotShifts(
  shifts: Shift[],
  date: string,
  slot: number
): Shift[] {
  return shifts.filter(
    item => item.shiftDate === date && shiftStartSlot(item) === slot
  );
}

export function validateStops(nodes: Shift["nodes"]) {
  if (nodes.length < 2) return "至少保留始发点和终点";
  let previous = 0;
  let previousId = "";
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    const isLast = index === nodes.length - 1;
    if (
      !node.nodeId ||
      node.planArriveTime == null ||
      node.planArriveTime === ""
    )
      return "请填写完整的节点与到达时间";
    const departEmpty =
      node.planDepartTime == null || node.planDepartTime === "";
    if (departEmpty && !isLast) return "仅终点可不填发车时间";
    const arrive = Number(node.planArriveTime);
    if (departEmpty) {
      if (arrive < previous) return "请保证下一站到达不早于上一站发车";
      previous = arrive;
      previousId = node.nodeId;
      continue;
    }
    const depart = Number(node.planDepartTime);
    if (
      !Number.isFinite(arrive) ||
      !Number.isFinite(depart) ||
      arrive < previous ||
      depart < arrive
    )
      return "请填写有效节点，并保证发车不早于到达、下一站到达不早于上一站发车";
    if (node.nodeId === previousId) return "相邻停靠点不能相同";
    previous = depart;
    previousId = node.nodeId;
  }
  return "";
}
