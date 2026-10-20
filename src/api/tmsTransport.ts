import { http } from "@/utils/http";
import type { Result, PageResult } from "./tms";
import type { PickupContainer } from "./tmsPickupExecution";

/** 新容器模型的车次执行：派车、签到、装车、发车、卸货、离站与完成。 */

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
    | "PENDING"
    | "WAITING_LOADING"
    | "WAITING_DEPARTURE"
    | "EXECUTING"
    | "COMPLETED"
    | "CANCELLED";
  plannedDepartureTime?: number;
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
  loadable: (id: string, stopId: string) =>
    request<PickupContainer[]>(
      "get",
      `${base}/${encodeURIComponent(id)}/loadable?stopId=${encodeURIComponent(stopId)}`
    ),
  assign: (
    id: string,
    data: { carrierId?: string; vehicleId: string; driverId: string }
  ) => request<Trip>("post", `${base}/${encodeURIComponent(id)}/assign`, data),
  arrive: (id: string, stopId: string) =>
    request<Trip>(
      "post",
      `${base}/${encodeURIComponent(id)}/arrive/${encodeURIComponent(stopId)}`
    ),
  load: (id: string, stopId: string, containerIds: string[]) =>
    request<Trip>("post", `${base}/${encodeURIComponent(id)}/load`, {
      stopId,
      containerIds
    }),
  depart: (id: string, stopId: string) =>
    request<Trip>(
      "post",
      `${base}/${encodeURIComponent(id)}/depart/${encodeURIComponent(stopId)}`
    ),
  unload: (id: string, stopId: string, containerIds: string[]) =>
    request<Trip>("post", `${base}/${encodeURIComponent(id)}/unload`, {
      stopId,
      containerIds
    }),
  complete: (id: string) =>
    request<Trip>("post", `${base}/${encodeURIComponent(id)}/complete`)
};
