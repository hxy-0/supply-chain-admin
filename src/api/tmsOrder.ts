import { http } from "@/utils/http";
import type { Result, PageResult } from "./tms";

export type OrderStatus =
  "PENDING" | "EXECUTING" | "COMPLETED" | "DELIVERED" | "CANCELLED";
export type Quantity = number | string;
export interface OrderItem {
  orderItemId?: string;
  lineNo?: number;
  goodsSource: "MANUAL" | "SKU";
  skuId?: string | number;
  skuCode?: string;
  goodsName: string;
  specText?: string;
  unit: string;
  orderedQuantity: Quantity;
  weightKg?: Quantity;
  volumeCm3?: Quantity;
  plannedQuantity?: Quantity;
  reservedQuantity?: Quantity;
  pickedQuantity?: Quantity;
  loadedQuantity?: Quantity;
  inTransitQuantity?: Quantity;
  arrivedQuantity?: Quantity;
  completedQuantity?: Quantity;
  historicalShortageQuantity?: Quantity;
  differenceQuantity?: Quantity;
  unfinishedQuantity?: Quantity;
}
export interface PickupPlanCommand {
  pickupNodeId: string;
  senderName: string;
  senderPhone: string;
  plannedPackageCount?: number;
  expectPickupTime?: number;
  version?: number;
}
export interface OrderCommand extends PickupPlanCommand {
  destinationNodeId: string;
  receiverName: string;
  receiverPhone: string;
  expectPickupTime?: number;
  expectDeliveryTime?: number;
  remark?: string;
  version?: number;
  items: OrderItem[];
}
export interface TmsOrder extends OrderCommand {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  destinationNodeName?: string;
  pickupNodeName?: string;
  /** 展示地址由物流节点解析返回，不再随订单存储或提交 */
  pickupAddress?: string;
  destinationAddress?: string;
  editable?: boolean;
  createTime?: number;
  closedTime?: number;
  cancelReason?: string;
}
export interface OrderTransport {
  containerItemId: string;
  orderItemId: string;
  goodsName: string;
  unit: string;
  containerId: string;
  containerCode: string;
  containerStatus: string;
  quantity: Quantity;
  pickedTime?: number;
  tripContainerId?: string;
  segmentStatus?: string;
  tripNo?: string;
  tripStatus?: string;
  carrierName?: string;
  loadNodeName?: string;
  unloadNodeName?: string;
  reservedTime?: number;
  loadedTime?: number;
  departedTime?: number;
  arrivedTime?: number;
  unloadedTime?: number;
  receivedQuantity?: Quantity;
  completedQuantity: Quantity;
}
async function request<T>(
  method: "get" | "post" | "put",
  path: string,
  data?: object
): Promise<T> {
  const result = await http.request<Result<T>>(
    method,
    `/api/tms/orders${path}`,
    { data }
  );
  if (result.code !== 0) throw new Error(result.message || "操作失败");
  return result.data;
}
export const orderApi = {
  transport: (id: string) =>
    request<OrderTransport[]>("get", `/${encodeURIComponent(id)}/transport`),
  create: (data: OrderCommand) => request<TmsOrder>("post", "", data),
  update: (id: string, data: OrderCommand) =>
    request<TmsOrder>("put", `/${encodeURIComponent(id)}`, data),
  updatePickupPlan: (id: string, data: PickupPlanCommand) =>
    request<TmsOrder>("put", `/${encodeURIComponent(id)}/pickup-plan`, data),
  cancel: (id: string, reason: string) =>
    request<TmsOrder>("post", `/${encodeURIComponent(id)}/cancel`, { reason }),
  close: (id: string, reason?: string) =>
    request<TmsOrder>("post", `/${encodeURIComponent(id)}/close`, { reason }),
  detail: (id: string) =>
    request<TmsOrder>("get", `/${encodeURIComponent(id)}`),
  page: (data: object) => request<PageResult<TmsOrder>>("post", "/page", data)
};
