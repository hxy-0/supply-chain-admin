import { http } from "@/utils/http";
import type { PageResult, Result } from "./tms";

export type Id = string | number;
export interface Zone {
  id: Id;
  warehouseId: Id;
  warehouseName?: string;
  code: string;
  name: string;
  zoneType: number;
  status: number;
  remark?: string;
}
export interface Location {
  id: Id;
  warehouseId: Id;
  zoneId: Id;
  zoneName?: string;
  code: string;
  barcode: string;
  locationType: number;
  status: number;
  remark?: string;
}
export interface Inventory {
  id: Id;
  warehouseId: Id;
  warehouseName?: string;
  locationId: Id;
  zoneId?: Id;
  locationCode: string;
  locationBarcode: string;
  skuId: Id;
  skuCode: string;
  skuName?: string;
  skuBarcode?: string;
  quantity: number;
  lockedQuantity: number;
  availableQuantity: number;
  updateTime?: number;
}
export interface InventoryLog {
  id: Id;
  movementType: number;
  bizNo: string;
  warehouseId: Id;
  locationId: Id;
  locationCode?: string;
  skuId: Id;
  skuCode?: string;
  quantity: number;
  createTime?: number;
}
export interface StockSummary {
  skuCount: number;
  totalQuantity: number;
  putawayQuantity: number;
  pendingPutawayQuantity: number;
  totalLockedQuantity: number;
  totalAvailableQuantity: number;
  occupiedLocationCount: number;
}
export interface Transfer {
  warehouseId: Id;
  requestId: string;
  skuId: Id;
  quantity: number;
  sourceLocationBarcode: string;
  targetLocationBarcode: string;
}
export class WmsBusinessError extends Error {}
async function post<T>(path: string, data: object = {}): Promise<T> {
  const result = await http.request<Result<T>>("post", `/api/wms${path}`, {
    data
  });
  if (result.code !== 0) {
    throw new WmsBusinessError(result.message || "仓储操作失败");
  }
  return result.data;
}
export const zoneTypes = ["存储区", "拣货区", "退货区", "隔离区"];
export const locationTypes = ["存储位", "拣货位", "暂存位"];
export const movementTypes = ["入库", "出库", "移库转出", "移库转入"];
export const storageApi = {
  scan: async (warehouseId: Id, barcode: string) => {
    const result = await http.request<Result<Location>>(
      "get",
      "/api/wms/locations/scan",
      { params: { warehouseId, barcode } }
    );
    if (result.code !== 0) {
      throw new WmsBusinessError(result.message || "库位解析失败");
    }
    return result.data;
  },
  zones: (query: object) => post<PageResult<Zone>>("/zones/page", query),
  saveZone: (form: object) => post<void>("/zones/saveOrUpdate", form),
  locations: (query: object) =>
    post<PageResult<Location>>("/locations/page", query),
  saveLocation: (form: object) => post<void>("/locations/saveOrUpdate", form)
};
export const inventoryApi = {
  page: (query: object) =>
    post<PageResult<Inventory>>("/inventory/page", query),
  logs: (query: object) =>
    post<PageResult<InventoryLog>>("/inventory/log/page", query),
  summary: () => post<StockSummary>("/inventory/summary"),
  transfer: (command: Transfer) => post<string>("/inventory/transfer", command)
};
