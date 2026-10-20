import { http } from "@/utils/http";
import type { Result, PageResult } from "./tms";
export interface ShiftNode {
  shiftNodeId?: string;
  nodeId: string;
  nodeName?: string;
  planArriveTime: number | string | null;
  planDepartTime: number | string | null;
  remark?: string;
  /** 前端行拖拽标识；保存前剔除，不提交后端 */
  _key?: string;
}
export interface Shift {
  shiftId: string;
  shiftNo: string;
  shiftName?: string;
  templateId?: string;
  templateNo?: string;
  routePlanId?: string;
  tempZone?: number;
  shiftDate: string;
  fromNodeName?: string;
  toNodeName?: string;
  planDepartTime?: number;
  planArriveTime?: number;
  /** 起点（首节点）计划到达时刻；周视图按时段归位 */
  startArriveTime?: number;
  status: number;
  statusDescription?: string;
  remark?: string;
  nodes: ShiftNode[];
}
export interface TemplateNode {
  templateNodeId?: string;
  nodeId: string;
  nodeName?: string;
  arriveTime: string;
  departTime: string;
  remark?: string;
  /** 前端行拖拽标识；保存前剔除，不提交后端 */
  _key?: string;
}
export interface ShiftRule {
  ruleId?: string;
  ruleName?: string;
  cronExpr: string;
  advanceDays: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  isEnable: boolean;
}
export interface ShiftTemplate {
  templateId?: string;
  templateNo: string;
  templateName?: string;
  routePlanId?: string;
  tempZone: number;
  isEnable: boolean;
  remark?: string;
  nodes: TemplateNode[];
  genRules: ShiftRule[];
}
async function request<T>(method: "get" | "post", path: string, data?: object) {
  const result = await http.request<Result<T>>(method, `/api${path}`, { data });
  if (result.code !== 0) throw new Error(result.message || "操作失败");
  return result.data;
}
export const shiftApi = {
  week: (weekStart: string) =>
    request<Shift[]>("post", "/shifts/week", { weekStart }),
  generateWeek: (weekStart: string) =>
    request<string[]>("post", "/shifts/generate-week", { weekStart }),
  detail: (id: string) =>
    request<Shift>("get", `/shifts/${encodeURIComponent(id)}`),
  save: (data: Shift) => request<string>("post", "/shifts/saveOrUpdate", data),
  templates: (data: object) =>
    request<PageResult<ShiftTemplate>>("post", "/shiftTemplates/page", data),
  template: (id: string) =>
    request<ShiftTemplate>("get", `/shiftTemplates/${encodeURIComponent(id)}`),
  saveTemplate: (data: ShiftTemplate) =>
    request<string>("post", "/shiftTemplates/saveOrUpdate", data)
};
