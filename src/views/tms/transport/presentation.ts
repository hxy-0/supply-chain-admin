import type { TripCargo } from "@/api/tmsTransport";

function addQuantity(left: string, right: string | number) {
  function units(value: string | number) {
    if (!/^\d+(?:\.\d{1,4})?$/.test(String(value)))
      throw new Error("商品数量格式无效");
    const [whole, fraction = ""] = String(value).split(".");
    return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, "0"));
  }
  const total = units(left) + units(right);
  const fraction = (total % 10000n)
    .toString()
    .padStart(4, "0")
    .replace(/0+$/, "");
  return `${total / 10000n}${fraction ? `.${fraction}` : ""}`;
}

export function tripCargoByOrder(containers: TripCargo[]) {
  type Allocation = {
    containerId: string;
    containerCode: string;
    containerType?: string;
    quantity: string | number;
    status: string;
    loadNodeName?: string;
    unloadNodeName?: string;
  };
  type Goods = {
    orderItemId: string;
    goodsName: string;
    unit: string;
    quantity: string;
    allocations: Allocation[];
  };
  const groups = new Map<
    string,
    { orderId: string; orderNo: string; items: Goods[] }
  >();
  for (const container of containers) {
    for (const item of container.items) {
      let order = groups.get(item.orderId);
      if (!order) {
        order = { orderId: item.orderId, orderNo: item.orderNo, items: [] };
        groups.set(item.orderId, order);
      }
      let good = order.items.find(row => row.orderItemId === item.orderItemId);
      if (!good) {
        good = {
          orderItemId: item.orderItemId,
          goodsName: item.goodsName,
          unit: item.unit,
          quantity: "0",
          allocations: []
        };
        order.items.push(good);
      }
      good.quantity = addQuantity(good.quantity, item.quantity);
      good.allocations.push({
        containerId: container.containerId,
        containerCode: container.containerCode,
        containerType: container.containerType,
        quantity: item.quantity,
        status: container.status,
        loadNodeName: container.loadNodeName,
        unloadNodeName: container.unloadNodeName
      });
    }
  }
  return [...groups.values()];
}
