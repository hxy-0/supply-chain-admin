import type { TmsOrder } from "@/api/tmsOrder";
export function validQuantity(value: unknown, positive = false) {
  return (
    /^(?:0|[1-9]\d{0,13})$/.test(String(value)) &&
    (!positive || Number(value) > 0)
  );
}
export function sortedPickupOrders(orders: TmsOrder[]) {
  return [...orders].sort(
    (a, b) =>
      (a.expectPickupTime ?? Infinity) - (b.expectPickupTime ?? Infinity) ||
      a.orderId.localeCompare(b.orderId)
  );
}
import type { OrderStatus } from "@/api/tmsOrder";
export function validMeasurement(value: unknown, positive = false) {
  return (
    /^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(String(value)) &&
    (!positive || Number(value) > 0)
  );
}
export const statusLabels: Record<OrderStatus, string> = {
  PENDING: "待提货",
  EXECUTING: "运输中",
  COMPLETED: "已完成",
  DELIVERED: "已送达",
  CANCELLED: "已取消"
};
export const formatWeight = (value?: number) =>
  value == null ? "—" : Number(value).toFixed(3);
export const formatVolume = (value?: number) =>
  value == null ? "—" : (Number(value) / 1_000_000).toFixed(2);

export function availablePickupQuantity(
  ordered: number | string,
  planned: number | string = "0"
) {
  const remaining = BigInt(ordered) - BigInt(planned);
  return remaining > 0n ? String(remaining) : "0";
}

export function allocationPreview(
  orders: TmsOrder[],
  quantities: Record<string, string>
) {
  return orders.map(order => {
    let selectedLines = 0;
    let remainingLines = 0;
    let invalidLines = 0;
    let allocatableLines = 0;
    for (const item of order.items) {
      const remaining = BigInt(
        availablePickupQuantity(item.orderedQuantity, item.plannedQuantity)
      );
      const requested = item.orderItemId
        ? quantities[item.orderItemId]?.trim()
        : "";
      const amount =
        requested && validQuantity(requested) ? BigInt(requested) : 0n;
      if (requested && (!validQuantity(requested) || amount > remaining)) {
        invalidLines++;
      }
      if (amount > 0n) {
        selectedLines++;
      }
      if (remaining > 0n) {
        allocatableLines++;
      }
      if (remaining > amount) {
        remainingLines++;
      }
    }
    return {
      orderId: order.orderId,
      orderNo: order.orderNo,
      selectedLines,
      remainingLines,
      invalidLines,
      allocatableLines
    };
  });
}

export function pickupAllocationError(
  ordered: number | string,
  planned: number | string | undefined,
  requested: string
) {
  if (!validQuantity(requested, true)) return "本次分配数量必须为正整数";
  const remaining = availablePickupQuantity(ordered, planned);
  return BigInt(requested) > BigInt(remaining)
    ? `本次分配数量不能超过剩余可分配数量（${remaining}）`
    : "";
}

export function buildOrderTripRoute(
  orders: TmsOrder[],
  transfer?: { id: string; name: string }
) {
  const sorted = sortedPickupOrders(orders);
  const stops: import("@/api/tmsPickup").TripRouteStop[] = [];
  function addOrderStop(
    nodeId: string,
    nodeName: string | undefined,
    pickup: boolean,
    time: number | undefined
  ) {
    const existing = stops.find(
      stop => stop.nodeId === nodeId && stop.pickup === pickup
    );
    if (!existing) {
      stops.push({
        nodeId,
        nodeName,
        pickup,
        plannedArrivalTime: time,
        plannedDepartureTime: time
      });
    } else if (time != null) {
      existing.plannedArrivalTime =
        existing.plannedArrivalTime == null
          ? time
          : Math.min(Number(existing.plannedArrivalTime), time);
      existing.plannedDepartureTime =
        existing.plannedDepartureTime == null
          ? time
          : Math.max(Number(existing.plannedDepartureTime), time);
    }
  }
  for (const order of sorted) {
    addOrderStop(
      order.pickupNodeId,
      order.pickupNodeName,
      true,
      order.expectPickupTime
    );
  }
  for (const order of sorted) {
    addOrderStop(
      transfer?.id ?? order.destinationNodeId,
      transfer?.name ?? order.destinationNodeName,
      false,
      order.expectDeliveryTime
    );
  }
  return stops;
}
export function tripRouteError(
  stops: import("@/api/tmsPickup").TripRouteStop[],
  orders: TmsOrder[],
  destinations: string[]
) {
  const pickups = new Set(orders.map(order => order.pickupNodeId));
  const visitedPickups = new Set<string>();
  const delivered = new Set<string>();
  for (const [index, stop] of stops.entries()) {
    const arrival =
      stop.plannedArrivalTime == null || stop.plannedArrivalTime === ""
        ? undefined
        : Number(stop.plannedArrivalTime);
    const departure =
      stop.plannedDepartureTime == null || stop.plannedDepartureTime === ""
        ? undefined
        : Number(stop.plannedDepartureTime);
    if (
      !stop.nodeId ||
      arrival == null ||
      !Number.isSafeInteger(arrival) ||
      arrival < 0 ||
      (index < stops.length - 1 && departure == null) ||
      (departure != null &&
        (!Number.isSafeInteger(departure) || departure < arrival))
    )
      return `第 ${index + 1} 站请填写有效节点及到发时间，同一节点发车时间不能早于到达时间`;
    if (stop.pickup) {
      if (!pickups.has(stop.nodeId) || visitedPickups.has(stop.nodeId))
        return "每个提货点必须且只能安排一次提货停靠";
      visitedPickups.add(stop.nodeId);
    } else if (destinations.includes(stop.nodeId)) {
      if (visitedPickups.size < pickups.size)
        return "必须完成全部订单提货后再送往收货点";
      if (delivered.has(stop.nodeId)) return "每个卸货点只能安排一次卸货停靠";
      delivered.add(stop.nodeId);
    }
  }
  if (
    stops.length < 2 ||
    !stops[0]?.pickup ||
    visitedPickups.size !== pickups.size ||
    destinations.some(node => !delivered.has(node)) ||
    !destinations.includes(stops.at(-1)?.nodeId ?? "") ||
    stops.at(-1)?.pickup
  )
    return "线路必须保留全部提货点及收货点，并以收货点结束";
}
