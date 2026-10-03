import { http } from "@/utils/http";

export interface Result<T> { code: number; message: string; data: T }
export interface PageResult<T> { records: T[]; total: number; current: number; size: number }
export interface QueueConfig { queueId: string; queueCode: string; queueName: string; sceneCode?: string; status?: number | string; callTimeoutSeconds?: number; ticketTypes?: TicketType[] }
export interface TicketType { ticketTypeId: string; queueId?: string; ticketTypeName: string; prefix: string; status?: number | string }
export interface QueueTicket { ticketId: string; queueId: string; ticketTypeId: string; ticketNo: string; status: number | string; userId?: string; resourceId?: string; callCount?: number; createTime?: number; calledTime?: number; startUseTime?: number }
export interface QueueResource { resourceId: string; ticketTypeId?: string; resourceNo?: string; resourceName?: string }
export interface VehicleLocation { locationId: string; vehicleId: string; plateNumber?: string; latitude: number; longitude: number; speedKph?: number; direction?: number; provider?: string; gpsTime: number }
export interface TrackResult { locations: VehicleLocation[]; originalCount: number; returnedCount: number; sampled: boolean }

async function request<T>(method: "get" | "post" | "delete", url: string, data?: object, params?: object): Promise<T> {
  const result = await http.request<Result<T>>(method, `/api${url}`, { data, params });
  if (result.code !== 0) throw new Error(result.message || "操作失败");
  return result.data;
}

export const queueApi = {
  pageConfig: (data: object) => request<PageResult<QueueConfig>>("post", "/queue/config/page", data),
  saveConfig: (data: object) => request<boolean>("post", "/queue/config/saveOrUpdate", data),
  ticketTypes: (queueId: string) => request<TicketType[]>("get", `/queue/config/ticketTypes/${queueId}`),
  tickets: (data: object) => request<PageResult<QueueTicket>>("post", "/queue/ticket/page", data),
  waiting: (queueId: string, typeId: string) => request<QueueTicket[]>("get", `/queue/ticket/waiting/${queueId}/${typeId}`),
  resources: (queueId: string) => request<QueueResource[]>("get", `/queue/ticket/resource/${queueId}`),
  take: (data: object) => request<QueueTicket>("post", "/queue/ticket/take", data),
  callNext: (queueId: string, typeId: string, resourceId?: string) => request<QueueTicket>("post", `/queue/ticket/callNext/${queueId}/${typeId}`, undefined, resourceId ? { resourceId } : undefined),
  startUse: (ticketId: string, resourceId?: string) => request<QueueTicket>("post", `/queue/ticket/startUse/${ticketId}`, undefined, resourceId ? { resourceId } : undefined),
  complete: (data: object) => request<{ ticket: QueueTicket; nextTicket?: QueueTicket }>("post", "/queue/ticket/complete", data),
  cancel: (ticketId: string) => request<QueueTicket>("post", `/queue/ticket/cancel/${ticketId}`, undefined, { reason: "管理台手动取消" }),
  processExpired: () => request<number>("post", "/queue/ticket/processExpired")
};

export type FleetKind = "drivers" | "carriers" | "vehicles" | "logisticNode";
export const fleetApi = {
  page: <T>(kind: FleetKind, data: object) => request<PageResult<T>>("post", `/${kind}/page`, data),
  save: (kind: FleetKind, data: object) => request<void>("post", `/${kind}/saveOrUpdate`, data),
  remove: (kind: FleetKind, id: string) => request<void>("delete", `/${kind}/delete/${id}`)
};

export const monitoringApi = {
  online: () => request<VehicleLocation[]>("get", "/monitoring/vehicle-location/online"),
  track: (vehicleId: string, startTime: number, endTime: number, maxPoints = 1000) =>
    request<TrackResult>("get", `/monitoring/vehicle-location/vehicle/${vehicleId}/track`, undefined, { startTime, endTime, maxPoints })
};
