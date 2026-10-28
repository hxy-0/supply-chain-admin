import { http } from "@/utils/http";
import type { Result, PageResult } from "./tms";
import type { PickupContainer } from "./tmsPickupExecution";

/** 管理端只查询车次、指派与取消；现场履约由司机小程序执行。 */

export interface TripStop {
  stopId: string;
  stopSeq: number;
  nodeId: string;
  nodeName?: string;
  plannedArrivalTime?: number;
  plannedDepartureTime?: number;
  arrivedTime?: number;
  departedTime?: number;
  status: "PENDING" | "ARRIVED" | "DEPARTED";
}

export interface TripCargo {
  tripContainerId: string;
  containerId: string;
  containerCode: string;
  containerType?: string;
  destinationNodeId?: string;
  destinationNodeName?: string;
  loadStopId: string;
  loadNodeName?: string;
  unloadStopId: string;
  unloadNodeName?: string;
  status: "RESERVED" | "LOADED" | "UNLOADED";
  reservedTime?: number;
  releasedTime?: number;
  items: PickupContainer["items"];
}

export interface UnloadingTask {
  stopId: string;
  nodeId: string;
  nodeName?: string;
  status: "PENDING" | "PARTIALLY_UNLOADED" | "FINISHED" | "CANCELLED";
  items: {
    orderItemId: string;
    orderId: string;
    orderNo: string;
    goodsName: string;
    unit: string;
    plannedQuantity: string;
    pickedQuantity: string;
    unloadedQuantity: string;
  }[];
}

export interface Trip {
  tripId: string;
  tripNo: string;
  planId?: string;
  carrierId?: string;
  carrierName?: string;
  vehicleId?: string;
  plateNumber?: string;
  driverId?: string;
  driverName?: string;
  shiftId?: string;
  status:
    | "PENDING_ASSIGNMENT"
    | "PENDING_EXECUTION"
    | "WAITING_DEPARTURE"
    | "IN_TRANSIT"
    | "DELIVERED"
    | "COMPLETED"
    | "CANCELLED";
  plannedDepartureTime?: number;
  acceptedTime?: number;
  actualDepartureTime?: number;
  completedTime?: number;
  stops: TripStop[];
  containers: TripCargo[];
  unloadingTasks: UnloadingTask[];
}

export interface TripQuery {
  tripNo?: string;
  planId?: string;
  carrierId?: string;
  status?: string;
  pageNum: number;
  pageSize: number;
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

const base = "/tms/trips";

export const tripApi = {
  page: (data: TripQuery) =>
    request<PageResult<Trip>>("post", `${base}/page`, data),
  detail: (id: string) =>
    request<Trip>("get", `${base}/${encodeURIComponent(id)}`),
  cancel: (id: string) =>
    request<Trip>("post", `${base}/${encodeURIComponent(id)}/cancel`),
  assign: (
    id: string,
    data: { carrierId?: string; vehicleId: string; driverId: string }
  ) => request<Trip>("post", `${base}/${encodeURIComponent(id)}/assign`, data)
};
