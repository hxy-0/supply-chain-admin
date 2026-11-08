import { http } from "@/utils/http";
import type { PageResult, Result } from "./tms";

export interface WaveTemplateStop {
  id?: string;
  templateId?: string;
  stopType: number;
  logisticNodeId: string;
  planArrivalStart?: string;
  planArrivalEnd?: string;
  planDepartureStart?: string;
  planDepartureEnd?: string;
}
export interface WaveGenerationRule {
  ruleId?: string;
  ruleName: string;
  cronExpr: string;
  advanceDays: string;
  isEnable?: boolean;
  planDepartTime?: number;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
}
export interface WaveTemplate {
  templateId: string;
  templateName: string;
  waveType: number;
  cityCode?: string;
  remark?: string;
  details: WaveTemplateStop[];
  generationRules: WaveGenerationRule[];
}
export type WaveTemplateInput = Omit<WaveTemplate, "templateId"> & {
  templateId?: string;
};
export interface CityWaveTemplate {
  templateId: string;
  templateName: string;
  departureType?: number;
  cityCode?: string;
  sourceNodeIds: string[];
  deliveryNodeIds: string[];
  deliveryDistrictCode?: string;
  remark?: string;
  generationRules: WaveGenerationRule[];
}
export type CityWaveTemplateInput = Omit<CityWaveTemplate, "templateId"> & {
  templateId?: string;
};
export interface WaveScheduleInput {
  waveId: string;
  planDepartTime: number;
  planCompleteTime?: number;
  schedulerId?: string;
  schedulerName?: string;
  remark?: string;
}
export interface WaveGenerationResult {
  success: boolean;
  message?: string;
  generatedWaveIds?: string[];
  generatedCount?: number;
}

export const waveTypeOptions = [
  { value: 0, label: "城配" },
  { value: 1, label: "干线" }
];
export const stopTypeOptions = [
  { value: 1, label: "提货" },
  { value: 2, label: "配送" }
];
export function waveTypeLabel(value?: number) {
  return waveTypeOptions.find(row => row.value === value)?.label ?? "-";
}

async function request<T>(path: string, data?: object): Promise<T> {
  const result = await http.request<Result<T>>(
    "post",
    `/api/waveTemplate${path}`,
    { data }
  );
  if (result.code !== 0) throw new Error(result.message || "波次模板操作失败");
  return result.data;
}
async function cityRequest<T>(path: string, data?: object): Promise<T> {
  const result = await http.request<Result<T>>(
    "post",
    `/api/cityWaveTemplate${path}`,
    { data }
  );
  if (result.code !== 0)
    throw new Error(result.message || "城市波次模板操作失败");
  return result.data;
}
/** 排程与生成端点直接返回业务值（无 Result 包装），失败由 HTTP 层抛出。 */
async function raw<T>(url: string, data?: object, params?: object): Promise<T> {
  return await http.request<T>("post", url, { data, params });
}

export const waveTemplateApi = {
  page: (query: object) => request<PageResult<WaveTemplate>>("/page", query),
  detail: (templateId: string) =>
    http
      .request<Result<WaveTemplate>>(
        "get",
        `/api/waveTemplate/findByIdWithDetails/${templateId}`
      )
      .then(result => {
        if (result.code !== 0)
          throw new Error(result.message || "波次模板加载失败");
        return result.data;
      }),
  save: (form: WaveTemplateInput) => request<void>("/saveOrUpdate", form),
  remove: (templateId: string) =>
    http
      .request<Result<void>>("delete", `/api/waveTemplate/delete/${templateId}`)
      .then(result => {
        if (result.code !== 0)
          throw new Error(result.message || "波次模板删除失败");
      })
};

export const cityWaveApi = {
  page: (query: object) =>
    cityRequest<PageResult<CityWaveTemplate>>("/page", query),
  detail: (templateId: string) =>
    http
      .request<Result<CityWaveTemplate>>(
        "get",
        `/api/cityWaveTemplate/findByIdWithRules/${templateId}`
      )
      .then(result => {
        if (result.code !== 0)
          throw new Error(result.message || "城市波次模板加载失败");
        return result.data;
      }),
  save: (form: CityWaveTemplateInput) =>
    cityRequest<void>("/saveOrUpdate", form),
  remove: (templateId: string) =>
    http
      .request<Result<void>>(
        "delete",
        `/api/cityWaveTemplate/delete/${templateId}`
      )
      .then(result => {
        if (result.code !== 0)
          throw new Error(result.message || "城市波次模板删除失败");
      })
};

export const waveScheduleApi = {
  create: (form: WaveScheduleInput) =>
    raw<boolean>("/api/wave/schedule/create", form),
  update: (form: WaveScheduleInput) =>
    raw<boolean>("/api/wave/schedule/update", form),
  cancel: (waveId: string) =>
    raw<boolean>(`/api/wave/schedule/cancel/${waveId}`)
};

export const waveGenerationApi = {
  generate: (form: {
    templateId: string;
    targetDate: string;
    endDate?: string;
  }) => raw<WaveGenerationResult>("/api/wave/generation/generate", form),
  generateToday: () =>
    raw<WaveGenerationResult>("/api/wave/generation/generate/today"),
  generateTomorrow: () =>
    raw<WaveGenerationResult>("/api/wave/generation/generate/tomorrow"),
  manual: (ruleId: string, targetDate: string) =>
    raw<WaveGenerationResult>(
      `/api/wave/generation/manual/${ruleId}`,
      undefined,
      {
        targetDate
      }
    ),
  calculateDates: (ruleId: string, startDate: string, endDate: string) =>
    raw<string[]>("/api/wave/generation/calculate-dates", undefined, {
      ruleId,
      startDate,
      endDate
    }),
  checkCron: (cronExpr: string) =>
    raw<boolean>("/api/wave/generation/check-cron", undefined, { cronExpr })
};
