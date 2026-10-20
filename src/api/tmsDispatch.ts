import { http } from "@/utils/http";
import type { Result, PageResult } from "./tms";
import type { PickupContainer } from "./tmsPickupExecution";
import type { PickupTask } from "./tmsPickup";
export interface VehicleTrip {
  tripId: string;
  tripNo: string;
  status: string;
  plannedDepartureTime?: number;
  actualDepartureTime?: number;
  completedTime?: number;
  stops: PickupTask["stops"];
  containers: PickupContainer[];
}
export interface DispatchTrip {
  tripId: string;
  tripNo: string;
  status: string;
  carrierId?: string;
  vehicleId?: string;
  driverId?: string;
  containerCount: number;
}
export interface DispatchPlan {
  planId: string;
  planNo: string;
  status: "DRAFT" | "ISSUED" | "EXECUTING" | "COMPLETED" | "CANCELLED";
  shiftId: string;
  shiftNo?: string;
  shiftName?: string;
  originNodeId: string;
  originNodeName?: string;
  destinationNodeId?: string;
  destinationNodeName?: string;
  plannedDepartureTime?: number;
  createTime?: number;
  /** 一份计划可拆多车，各自派车执行 */
  trips: DispatchTrip[];
  containers: PickupContainer[];
}
export interface DispatchShift {
  shiftId: string;
  shiftNo: string;
  shiftName: string;
  fromNodeName: string;
  toNodeName: string;
  planDepartTime?: number;
  status: number;
}
async function request<T>(
  method: "get" | "post",
  path: string,
  data?: object
): Promise<T> {
  const result = await http.request<Result<T>>(method, `/api${path}`, { data });
  if (result.code !== 0) throw new Error(result.message || "操作失败");
  return result.data;
}
const base = "/tms/dispatch-plans";
export const dispatchApi = {
  vehicleTrips: (id: string, pageNum: number) =>
    request<PageResult<VehicleTrip>>(
      "post",
      `/tms/vehicles/${encodeURIComponent(id)}/trips`,
      { pageNum, pageSize: 10 }
    ),
  page: (data: object) =>
    request<PageResult<DispatchPlan>>("post", `${base}/page`, data),
  create: (data: { shiftId: string }) =>
    request<DispatchPlan>("post", base, data),
  detail: (id: string) =>
    request<DispatchPlan>("get", `${base}/${encodeURIComponent(id)}`),
  available: (id: string) =>
    request<PickupContainer[]>(
      "get",
      `${base}/${encodeURIComponent(id)}/available`
    ),
  /** 为草稿计划追加空车次（复制班次停靠时刻表），采集容器后可手动拆车 */
  addTrip: (id: string) =>
    request<DispatchPlan>("post", `${base}/${encodeURIComponent(id)}/trips`),
  cargo: (id: string, tripId: string, containerIds: string[]) =>
    request<DispatchPlan>("post", `${base}/${encodeURIComponent(id)}/cargo`, {
      tripId,
      containerIds
    }),
  issue: (id: string) =>
    request<DispatchPlan>("post", `${base}/${encodeURIComponent(id)}/issue`),
  cancelTrip: (id: string, tripId: string) =>
    request<DispatchPlan>(
      "post",
      `${base}/${encodeURIComponent(id)}/trips/${encodeURIComponent(tripId)}/cancel`
    ),
  cancel: (id: string) =>
    request<DispatchPlan>("post", `${base}/${encodeURIComponent(id)}/cancel`),
  shifts: (shiftNo = "") =>
    request<PageResult<DispatchShift>>("post", "/shifts/page", {
      shiftNo,
      pageNum: 1,
      pageSize: 50,
      status: 10
    })
};
