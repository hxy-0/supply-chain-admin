import { http } from "@/utils/http";
import type { PageResult, Result } from "./tms";
import type { Id } from "./pms";

export interface InboundItem {
  id: Id;
  sourceLineNo: string;
  unassignedQuantity: number;
  skuId: Id;
  skuCode?: string;
  skuName?: string;
  expectedQuantity: number;
  receivedQuantity: number;
  putawayQuantity: number;
}
export interface InboundOrder {
  id: Id;
  inboundNo: string;
  warehouseId: Id;
  warehouseName: string;
  status: number;
  sourceType: string;
  sourceNo?: string;
  deliveryBatchNo?: string;
  supplierName?: string;
  createTime?: number;
  items: InboundItem[];
}
export interface InboundCreate {
  sourceType: string;
  sourceNo?: string;
  deliveryBatchNo?: string;
  warehouseId: Id;
  inboundNo?: string;
  supplierName?: string;
  items: { sourceLineNo: string; skuId: Id; expectedQuantity: number }[];
}
export interface PutawayDetail {
  id: Id;
  palletCode: string;
  skuCode?: string;
  skuName?: string;
  locationCode: string;
  quantity: number;
  createTime?: number;
}
export interface InboundPallet {
  palletCode: string;
  items: {
    skuId: Id;
    skuCode?: string;
    skuName?: string;
    receivedQuantity: number;
    putawayQuantity: number;
    pendingQuantity: number;
  }[];
}
export const inboundStatuses = [
  "待收货",
  "收货中",
  "上架中",
  "已完成",
  "已取消",
  "待上架"
];

async function request<T>(
  method: "get" | "post" | "delete",
  path: string,
  data?: object,
  params?: object
) {
  const result = await http.request<Result<T>>(
    method,
    `/api/wms/inbounds${path}`,
    { data, params }
  );
  if (result.code !== 0) throw new Error(result.message || "入库操作失败");
  return result.data;
}
export const inboundApi = {
  page: (query: object) =>
    request<PageResult<InboundOrder>>("post", "/page", query),
  create: (cmd: InboundCreate) => request<Id>("post", "/create", cmd),
  cancel: (id: Id) => request<void>("delete", `/cancel/${id}`),
  detail: (id: Id) => request<InboundOrder>("get", `/${id}`),
  putaways: (id: Id) => request<PutawayDetail[]>("get", `/${id}/putaways`),
  pallet: (id: Id, arrivalId: Id, palletCode: string) =>
    request<InboundPallet>("get", `/${id}/pallet`, undefined, {
      arrivalId,
      palletCode
    })
};

export interface ArrivalItem {
  id: Id;
  inboundId: Id;
  inboundItemId: Id;
  inboundNo: string;
  sourceNo?: string;
  sourceLineNo: string;
  skuId: Id;
  skuCode: string;
  skuName: string;
  expectedQuantity: number;
  receivedQuantity: number;
}
export interface Arrival {
  id: Id;
  arrivalNo: string;
  warehouseId: Id;
  tripId?: string;
  tripNo?: string;
  arrivalTime: number;
  status: number;
  remark?: string;
  items: ArrivalItem[];
}
export const sourceTypes = [
  { value: "MANUAL", label: "手工入库" },
  { value: "PURCHASE", label: "采购入库" },
  { value: "TRANSFER", label: "调拨入库" },
  { value: "RETURN", label: "退货入库" }
];
export const arrivalStatuses = ["待收货", "收货中", "本批收齐", "已取消"];
async function arrivalRequest<T>(
  method: "get" | "post",
  path: string,
  data?: object,
  params?: object
) {
  const result = await http.request<Result<T>>(
    method,
    "/api/wms/inbound-arrivals" + path,
    { data, params }
  );
  if (result.code !== 0) throw new Error(result.message || "到货操作失败");
  return result.data;
}
export const arrivalApi = {
  page: (params: object) =>
    arrivalRequest<PageResult<Arrival>>("get", "", undefined, params),
  create: (data: {
    warehouseId: Id;
    tripId?: string;
    arrivalTime: number;
    remark?: string;
    items: { inboundItemId: Id; expectedQuantity: number }[];
  }) => arrivalRequest<Id>("post", "", data),
  cancel: (id: Id) => arrivalRequest<void>("post", "/" + id + "/cancel")
};
