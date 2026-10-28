import { http } from "@/utils/http";
import type { PageResult, Result } from "./tms";

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  warehouseType: number;
  status: number;
  removalStrategy?: number;
  logisticNodeId: string;
  logisticNodeName?: string;
  contactPerson?: string;
  contactPhone?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  remark?: string;
  createTime?: number;
  updateTime?: number;
}
export type WarehouseForm = Omit<Warehouse, "id"> & { id?: number };

async function request<T>(path: string, data: object): Promise<T> {
  const result = await http.request<Result<T>>(
    "post",
    `/api/wms/warehouses${path}`,
    { data }
  );
  if (result.code !== 0) {
    throw new Error(result.message || "仓库操作失败");
  }
  return result.data;
}

export const warehouseApi = {
  page: (query: object) => request<PageResult<Warehouse>>("/page", query),
  save: (form: WarehouseForm) => request<void>("/saveOrUpdate", form),
  status: (id: number, status: number) =>
    request<void>(`/${id}/status`, { status })
};
