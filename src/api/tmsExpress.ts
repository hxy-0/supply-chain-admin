import { http } from "@/utils/http";
import type { PageResult, Result } from "./tms";

export interface LineHaulRoute {
  lineId: string;
  fromNodeId: string;
  fromNodeName?: string;
  toNodeId: string;
  toNodeName?: string;
  distanceKm?: number;
  hours?: number;
  isEnable?: boolean;
  remark?: string;
}
export type LineHaulRouteInput = Omit<LineHaulRoute, "lineId"> & {
  lineId?: string;
};
export interface RoutePlanLeg {
  legSeq?: number;
  legType?: number;
  fromNodeId?: string;
  fromNodeName?: string;
  toNodeId?: string;
  toNodeName?: string;
  distanceKm?: number;
  hours?: number;
}
export interface RoutePlan {
  routePlanId?: string;
  sourceNodeId?: string;
  destNodeId?: string;
  totalDistanceKm?: number;
  totalHours?: number;
  legCount?: number;
  legs: RoutePlanLeg[];
}
export interface NodeServiceRelation {
  relationId: string;
  upstreamNodeId: string;
  downstreamNodeId: string;
  isEnable?: boolean;
  remark?: string;
}
export type NodeServiceRelationInput = Omit<
  NodeServiceRelation,
  "relationId"
> & {
  relationId?: string;
};
export interface PickupServiceOrder {
  serviceOrderId: string;
  serviceNo: string;
  orderId: string;
  orderNo: string;
  status: number;
  courierName?: string;
  courierPhone?: string;
  appointStartTime?: number;
  appointEndTime?: number;
  completeTime?: number;
  actualWeightKg?: number;
  actualVolumeCm3?: number;
  actualPieceCount?: number;
  cancelReason?: string;
  remark?: string;
}
export interface HandoverSheetItem {
  itemId: string;
  handoverId?: string;
  waybillId?: string;
  waybillNo: string;
}
export interface HandoverSheet {
  handoverId: string;
  handoverNo: string;
  handoverType: number;
  fromNodeId: string;
  fromNodeName?: string;
  toNodeId: string;
  toNodeName?: string;
  tripId?: string;
  loadStopSeq?: number;
  unloadStopSeq?: number;
  status: number;
  pieceCount?: number;
  totalWeightKg?: number;
  departTime?: number;
  arriveTime?: number;
  receiveTime?: number;
  receiveOperator?: string;
  exceptionRemark?: string;
  remark?: string;
  items?: HandoverSheetItem[];
}
export interface TripStop {
  stopId?: string;
  tripId?: string;
  stopSeq?: number;
  nodeId: string;
  nodeName?: string;
  planArriveTime?: number;
  planDepartTime?: number;
  actualArriveTime?: number;
  actualDepartTime?: number;
  remark?: string;
}
export interface TripSheet {
  tripId: string;
  tripNo: string;
  transportMode?: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  vehicleId?: string;
  plateNumber?: string;
  driverId?: string;
  driverName?: string;
  departNodeId?: string;
  departNodeName?: string;
  planDepartTime?: number;
  actualDepartTime?: number;
  completeTime?: number;
  status: number;
  remark?: string;
  stops?: TripStop[];
}
export interface TripManifestWaybill {
  waybillId?: string;
  waybillNo?: string;
  status?: number;
  [key: string]: unknown;
}

export const pickupStatuses: Record<number, string> = {
  10: "待接单",
  20: "已接单",
  30: "已完成",
  99: "已取消"
};
export const handoverStatuses: Record<number, string> = {
  10: "已创建",
  20: "已发车",
  30: "已到达",
  40: "已接收",
  99: "已作废"
};
export const handoverTypes: Record<number, string> = {
  1: "短驳交接",
  2: "干线交接"
};
export const tripStatuses: Record<number, string> = {
  10: "已计划",
  30: "在途",
  40: "已完成",
  99: "已取消"
};
export const legTypes: Record<number, string> = {
  1: "短驳/末端",
  2: "干线"
};

async function request<T>(
  method: "get" | "post" | "delete",
  url: string,
  data?: object,
  params?: object
): Promise<T> {
  const result = await http.request<Result<T>>(method, url, { data, params });
  if (result.code !== 0) throw new Error(result.message || "快运操作失败");
  return result.data;
}
const get = <T>(url: string, params?: object) =>
  request<T>("get", url, undefined, params);
const post = <T>(url: string, data?: object) => request<T>("post", url, data);

export const lineApi = {
  page: (query: object) =>
    post<PageResult<LineHaulRoute>>("/api/express/line/page", query),
  detail: (lineId: string) =>
    get<LineHaulRoute>(`/api/express/line/detail/${lineId}`),
  save: (form: LineHaulRouteInput) =>
    post<LineHaulRoute>("/api/express/line/saveOrUpdate", form),
  remove: (lineId: string) =>
    request<void>("delete", `/api/express/line/delete/${lineId}`),
  routePlan: (fromNodeId: string, toNodeId: string) =>
    get<RoutePlan>("/api/express/line/routePlan", { fromNodeId, toNodeId })
};

export const relationApi = {
  page: (query: object) =>
    post<PageResult<NodeServiceRelation>>("/api/express/relation/page", query),
  save: (form: NodeServiceRelationInput) =>
    post<void>("/api/express/relation/saveOrUpdate", form),
  remove: (relationId: string) =>
    request<void>("delete", `/api/express/relation/delete/${relationId}`),
  downstream: (upstreamNodeId: string) =>
    get<NodeServiceRelation[]>("/api/express/relation/downstream", {
      upstreamNodeId
    })
};

export const pickupApi = {
  page: (query: object) =>
    post<PageResult<PickupServiceOrder>>("/api/express/pickup/page", query),
  detail: (serviceOrderId: string) =>
    get<PickupServiceOrder>(`/api/express/pickup/detail/${serviceOrderId}`),
  create: (form: {
    orderId: string;
    appointStartTime?: number;
    appointEndTime?: number;
    remark?: string;
  }) => post<void>("/api/express/pickup/create", form),
  accept: (form: {
    serviceOrderId: string;
    courierName: string;
    courierPhone?: string;
  }) => post<void>("/api/express/pickup/accept", form),
  complete: (form: {
    serviceOrderId: string;
    actualWeightKg?: number;
    actualVolumeCm3?: number;
    actualPieceCount?: number;
    actualPickupTime?: number;
  }) => post<void>("/api/express/pickup/complete", form),
  cancel: (serviceOrderId: string) =>
    post<void>(`/api/express/pickup/cancel/${serviceOrderId}`)
};

export const handoverApi = {
  page: (query: object) =>
    post<PageResult<HandoverSheet>>("/api/express/handover/page", query),
  detail: (handoverId: string) =>
    get<HandoverSheet>(`/api/express/handover/detail/${handoverId}`),
  create: (form: {
    tripId?: string;
    handoverType: number;
    fromNodeId: string;
    toNodeId: string;
    waybillNos: string[];
    remark?: string;
  }) => post<HandoverSheet>("/api/express/handover/create", form),
  depart: (handoverId: string) =>
    post<void>(`/api/express/handover/depart/${handoverId}`),
  arrive: (handoverId: string) =>
    post<void>(`/api/express/handover/arrive/${handoverId}`),
  receive: (handoverId: string, scannedWaybillNos: string[]) =>
    post<unknown>(`/api/express/handover/receive/${handoverId}`, {
      scannedWaybillNos
    }),
  byTrip: (tripId: string) =>
    get<HandoverSheet[]>(`/api/express/handover/byTrip/${tripId}`)
};

export const tripSheetApi = {
  page: (query: object) =>
    post<PageResult<TripSheet>>("/api/express/trip/page", query),
  detail: (tripId: string) =>
    get<TripSheet>(`/api/express/trip/detail/${tripId}`),
  create: (form: {
    vehicleId: string;
    driverId: string;
    planDepartTime?: number;
    stops: {
      nodeId: string;
      planArriveTime?: number;
      planDepartTime?: number;
      remark?: string;
    }[];
    remark?: string;
  }) => post<TripSheet>("/api/express/trip/create", form),
  depart: (tripId: string) => post<void>(`/api/express/trip/depart/${tripId}`),
  arriveStop: (tripId: string, stopSeq: number) =>
    post<void>(`/api/express/trip/arrive/${tripId}/${stopSeq}`),
  finish: (tripId: string) => post<void>(`/api/express/trip/finish/${tripId}`),
  manifest: (tripId: string) =>
    get<TripManifestWaybill[]>(`/api/express/trip/manifest/${tripId}`),
  handovers: (tripId: string) =>
    get<HandoverSheet[]>(`/api/express/trip/handovers/${tripId}`)
};
