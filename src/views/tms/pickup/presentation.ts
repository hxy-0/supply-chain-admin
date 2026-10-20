import type { PickupTask } from "@/api/tmsPickup";
import type { PickupContainer } from "@/api/tmsPickupExecution";

export function pickupGoodsGroups(
  task: PickupTask,
  containers: PickupContainer[]
) {
  const lines = new Map(task.items.map(item => [item.orderItemId, item]));
  const actual = containers.flatMap(container =>
    container.items.map(item => ({
      ...item,
      orderId: lines.get(item.orderItemId)?.orderId,
      orderNo: lines.get(item.orderItemId)?.orderNo,
      containerCode: container.containerCode,
      containerType: container.containerType
    }))
  );
  const orders = [...new Set(task.items.map(item => item.orderId))].map(
    orderId => ({
      orderId,
      orderNo:
        task.items.find(item => item.orderId === orderId)?.orderNo || orderId,
      planned: task.items
        .filter(item => item.orderId === orderId)
        .map(item => ({
          ...item,
          allocations: actual.filter(
            allocation => allocation.orderItemId === item.orderItemId
          )
        })),
      actual: actual.filter(item => item.orderId === orderId)
    })
  );
  return {
    orders,
    containerCount: containers.length,
    virtualCount: containers.filter(
      container => container.containerType === "虚拟托盘"
    ).length
  };
}

export function createPalletCode(type: string) {
  return `${type === "虚拟托盘" ? "V" : "P"}${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
}
