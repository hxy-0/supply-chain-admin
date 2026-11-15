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
  cancelledQuantity: number;
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
export interface PurchaseExecution {
  executionId: string;
  executionNo: string;
  status: "CREATED" | "EXECUTING" | "COMPLETED" | "CANCELLED";
  cancelReason?: string;
  version: number;
  createTime: number;
  startTime?: number;
  completedTime?: number;
  items: PurchaseExecutionItem[];
}
export interface PurchaseFulfillmentItem {
  fulfillmentItemId: string;
  orderItemId: string;
  skuId: Id;
  skuCode: string;
  goodsName: string;
  specText?: string;
  unit: string;
  quantity: number;
}
export interface PurchaseExecutionItem extends PurchaseFulfillmentItem {
  executionItemId: string;
}
export interface PurchaseFulfillment {
  fulfillmentId: string;
  fulfillmentNo: string;
  status: "PENDING" | "EXECUTING" | "COMPLETED" | "CANCELLED";
  cancelReason?: string;
  version: number;
  createTime: number;
  expectPickupTime: number;
  expectDeliveryTime: number;
  items: PurchaseFulfillmentItem[];
  executions: PurchaseExecution[];
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
  purchaseFulfillments: PurchaseFulfillment[];
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
  createPurchaseExecution: (fulfillment: PurchaseFulfillment) =>
    request<OmsOrder>(
      "post",
      `/purchase-fulfillments/${fulfillment.fulfillmentId}/executions`,
      { version: fulfillment.version }
    ),
  startPurchaseExecution: (execution: PurchaseExecution) =>
    request<OmsOrder>(
      "post",
      `/purchase-executions/${execution.executionId}/start`,
      {
        version: execution.version
      }
    ),
  cancelPurchaseExecution: (execution: PurchaseExecution, reason: string) =>
    request<OmsOrder>(
      "post",
      `/purchase-executions/${execution.executionId}/cancel`,
      {
        version: execution.version,
        reason
      }
    ),
  cancel: (order: OmsOrder, reason: string) =>
    request<OmsOrder>("post", `/${order.orderId}/cancel`, {
      version: order.version,
      reason
    })
};
