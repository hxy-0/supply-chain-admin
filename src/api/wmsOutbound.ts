import { http } from "@/utils/http";
import type { PageResult, Result } from "./tms";
import type { Id } from "./pms";
export interface OutboundItem {
  id: Id;
  skuId: Id;
  skuCode?: string;
  skuName?: string;
  quantity: number;
  pickedQuantity: number;
  packedQuantity: number;
}
export interface OutboundPallet {
  containerId: string;
  containerCode: string;
  originNodeName: string;
  destinationNodeName: string;
  products: {
    skuId: Id;
    skuCode: string;
    goodsName: string;
    quantity: number;
  }[];
}
export interface OutboundOrder {
  id: Id;
  outboundNo: string;
  warehouseId: Id;
  warehouseName: string;
  destinationNodeId: string;
  destinationNodeName: string;
  status: number;
  orderNo?: string;
  createTime?: number;
  items: OutboundItem[];
  allocations: {
    id: Id;
    locationCode: string;
    skuCode: string;
    skuName: string;
    quantity: number;
  }[];
  pallets: OutboundPallet[];
}
export interface OutboundCreate {
  warehouseId: Id;
  destinationNodeId: string;
  orderNo?: string;
  items: { skuId: Id; quantity: number }[];
}
export const outboundStatuses = [
  "待分配",
  "待拣货",
  "待打板",
  "打板中",
  "已打板",
  "已发运",
  "已取消"
];
async function request<T>(
  method: "get" | "post" | "delete",
  path: string,
  data?: object
) {
  const result = await http.request<Result<T>>(
    method,
    `/api/wms/outbounds${path}`,
    { data }
  );
  if (result.code !== 0) throw new Error(result.message || "出库操作失败");
  return result.data;
}
export const outboundApi = {
  page: (query: object) =>
    request<PageResult<OutboundOrder>>("post", "/page", query),
  create: (cmd: OutboundCreate) => request<Id>("post", "/create", cmd),
  detail: (id: Id) => request<OutboundOrder>("get", `/${id}`),
  allocate: (id: Id) => request<void>("post", `/allocate/${id}`),
  cancel: (id: Id) => request<void>("delete", `/cancel/${id}`)
};
