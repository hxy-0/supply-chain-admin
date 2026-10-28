import { http } from "@/utils/http";
import type { Result, PageResult } from "./tms";

export interface Waybill {
  waybillId: string;
  waybillNo: string;
  orderId: string;
  orderNo: string;
  pickupType: number;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  currentNodeId?: string;
  status: number;
  goodsName?: string;
  goodsSummary?: string;
  weightKg?: number;
  volumeCm3?: number;
  pieceCount?: number;
  signedTime?: number;
  signOperator?: string;
  cancelReason?: string;
  remark?: string;
  createTime?: number;
}

export interface WaybillItem {
  itemId: string;
  orderItemId: string;
  skuId?: string | number;
  skuCode?: string;
  goodsName?: string;
  specText?: string;
  unit?: string;
  actualQuantity: number;
  actualPickupTime?: number;
}

export interface WaybillTripSegment {
  tripId: string;
  tripNo?: string;
  transportMode?: string;
  plateNumber?: string;
  driverName?: string;
  fromNodeName?: string;
  toNodeName?: string;
  handoverStatus?: number;
  departTime?: number;
  arriveTime?: number;
}

export interface WaybillTrack {
  trackId: string;
  waybillId: string;
  waybillNo?: string;
  eventType: number;
  nodeId?: string;
  nodeName?: string;
  eventDesc?: string;
  refNo?: string;
  eventTime: number;
}

export interface WaybillDetail {
  waybill: Waybill;
  items: WaybillItem[];
  actualPickupTime?: number;
  trips: WaybillTripSegment[];
  tracks: WaybillTrack[];
}

async function request<T>(
  method: "get" | "post",
  path: string,
  data?: object,
  params?: object
): Promise<T> {
  const result = await http.request<Result<T>>(
    method,
    `/api/express/waybill${path}`,
    {
      data,
      params
    }
  );
  if (result.code !== 0) throw new Error(result.message || "操作失败");
  return result.data;
}

export const waybillApi = {
  page: (data: object) => request<PageResult<Waybill>>("post", "/page", data),
  detail: (id: string) =>
    request<WaybillDetail>("get", `/detail/${encodeURIComponent(id)}`),
  tracks: (id: string) =>
    request<WaybillTrack[]>("get", `/tracks/${encodeURIComponent(id)}`)
};
