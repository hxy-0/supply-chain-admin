import { http } from "@/utils/http";
import type { PageResult, Result } from "./tms";
import type { Id } from "./wmsInventory";

export interface Shelf {
  id: Id;
  warehouseId: Id;
  warehouseName?: string;
  zoneId: Id;
  zoneName?: string;
  code: string;
  shelfLevel: number;
  shelfColumn: number;
  slotCount?: number;
  firstSlotCode?: string;
  lastSlotCode?: string;
  status: number;
  remark?: string;
  updateTime?: number;
}
export type ShelfForm = {
  id?: Id;
  warehouseId: Id;
  zoneId: Id;
  code: string;
  shelfLevel: number;
  shelfColumn: number;
  status: number;
  remark?: string;
};

export const shelfStatuses = ["启用", "停用"];

/** 仓位编码 = 货架编码前缀 + 两位层号 + 两位列号，与后端 WmsShelf.slotCodes 保持一致。 */
export function slotCodes(code: string, level: number, column: number) {
  const codes: string[] = [];
  for (let currentLevel = 1; currentLevel <= level; currentLevel++) {
    for (let currentColumn = 1; currentColumn <= column; currentColumn++) {
      codes.push(
        `${code}${String(currentLevel).padStart(2, "0")}${String(currentColumn).padStart(2, "0")}`
      );
    }
  }
  return codes;
}

async function request<T>(path: string, data: object): Promise<T> {
  const result = await http.request<Result<T>>(
    "post",
    `/api/wms/shelves${path}`,
    { data }
  );
  if (result.code !== 0) {
    throw new Error(result.message || "货架操作失败");
  }
  return result.data;
}

export const shelfApi = {
  page: (query: object) => request<PageResult<Shelf>>("/page", query),
  save: (form: ShelfForm) => request<void>("/saveOrUpdate", form)
};
