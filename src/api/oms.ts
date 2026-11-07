import { http } from "@/utils/http";
import type { Id } from "./pms";
import type { PageResult, Result } from "./tms";

export type OrderType = "PURCHASE" | "TRANSFER";
export type OrderStatus =
  "DRAFT" | "RELEASED" | "FULFILLING" | "COMPLETED" | "CANCELLED";
export const orderStatuses: Record<OrderStatus, string> = {
  DRAFT: "草稿",
  RELEASED: "已释放",
  FULFILLING: "履约中",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};
export interface OrderItemInput {
  skuId: Id;
  unit: string;
  quantity: number;
}
export interface OrderItem extends OrderItemInput {
  orderItemId: string;
  skuCode: string;
  goodsName: string;
  specText?: string;
  shippedQuantity: number;
  deliveredQuantity: number;
  receivedQuantity: number;
  putawayQuantity: number;
}
export interface OrderInput {
  orderType: OrderType;
  supplierName?: string;
  pickupNodeId?: string;
  sourceWarehouseId?: Id;
  targetWarehouseId?: Id;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  plannedPackageCount: number;
  expectPickupTime: number;
  expectDeliveryTime: number;
  remark?: string;
  version?: number;
  items: OrderItemInput[];
}
export interface OrderDocument {
  documentType: "OUTBOUND" | "SHIPMENT" | "TRANSPORT" | "INBOUND";
  documentId: string;
  documentNo: string;
  status: string;
  updateTime: number;
}
export interface OmsOrder extends OrderInput {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  version: number;
  sourceWarehouseName?: string;
  targetWarehouseName: string;
  pickupNodeName: string;
  destinationNodeName: string;
  destinationNodeId: string;
  cancelReason?: string;
  createTime: number;
  releasedTime?: number;
  completedTime?: number;
  items: OrderItem[];
  documents: OrderDocument[];
}
async function request<T>(method: "get" | "post", path: string, data?: object) {
  const response = await http.request<Result<T>>(
    method,
    `/api/oms/orders${path}`,
    { data }
  );
  if (response.code !== 0) throw new Error(response.message || "订单操作失败");
  return response.data;
}
export const omsApi = {
  page: (query: object) =>
    request<PageResult<OmsOrder>>("post", "/page", query),
  detail: (id: string) => request<OmsOrder>("get", `/${id}`),
  create: (cmd: OrderInput) => request<OmsOrder>("post", "/create", cmd),
  update: (id: string, cmd: OrderInput) =>
    request<OmsOrder>("post", `/${id}/update`, cmd),
  release: (order: OmsOrder) =>
    request<OmsOrder>("post", `/${order.orderId}/release`, {
      version: order.version
    }),
  cancel: (order: OmsOrder, reason: string) =>
    request<OmsOrder>("post", `/${order.orderId}/cancel`, {
      version: order.version,
      reason
    })
};
