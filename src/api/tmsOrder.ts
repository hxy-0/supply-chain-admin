import { http } from "@/utils/http";
import type { Result, PageResult } from "./tms";
export interface ExpressOrder {
  orderId: string;
  orderNo: string;
  status: number;
  pickupType: number;
  tempZone: number;
  pieceCount?: number;
  weightKg?: number;
  volumeCm3?: number;
  sender: { name: string; phone: string };
  receiver: { name: string; phone: string };
  senderAddress: OrderAddress;
  receiverAddress: OrderAddress;
  expectPickupTime?: number;
  expectDeliveryTime?: number;
  goodsQuantity: number;
  actualPickupTime?: number;
  actualCompletionTime?: number;
  items: OrderItem[];
  remark?: string;
  cancelReason?: string;
  createTime?: number;
}
export interface OrderItem {
  itemId?: string;
  goodsSource: number;
  skuId?: string | number;
  skuCode?: string;
  goodsName: string;
  specText?: string;
  quantity: number;
  unit: string;
  weightKg?: number;
  volumeCm3?: number;
  actualQuantity: number;
  remainingQuantity: number;
}
export interface OrderAddress {
  formattedAddress: string;
  province?: string;
  city?: string;
  district?: string;
  adCode?: string;
}
export interface OrderCommand {
  pickupType: number;
  tempZone: number;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  senderProvince?: string;
  senderCity?: string;
  senderDistrict?: string;
  senderAdCode?: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverProvince?: string;
  receiverCity?: string;
  receiverDistrict?: string;
  receiverAdCode?: string;
  expectPickupTime?: number;
  expectDeliveryTime?: number;
  remark?: string;
  items: OrderItem[];
}
async function request<T>(
  method: "get" | "post" | "put" | "delete",
  path: string,
  data?: object,
  params?: object
): Promise<T> {
  const result = await http.request<Result<T>>(
    method,
    `/api/express/order${path}`,
    { data, params }
  );
  if (result.code !== 0) throw new Error(result.message || "操作失败");
  return result.data;
}
export const orderApi = {
  update: (id: string, data: OrderCommand) =>
    request<ExpressOrder>("put", `/update/${encodeURIComponent(id)}`, data),
  cancel: (id: string, reason: string) =>
    request<void>("delete", `/cancel/${encodeURIComponent(id)}`, undefined, {
      reason
    }),
  page: (data: object) =>
    request<PageResult<ExpressOrder>>("post", "/page", data),
  detail: (id: string) =>
    request<ExpressOrder>("get", `/detail/${encodeURIComponent(id)}`)
};
