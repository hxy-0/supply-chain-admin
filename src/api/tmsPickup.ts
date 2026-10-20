import { http } from "@/utils/http";
import type { Result } from "./tms";
import type { Quantity } from "./tmsOrder";
export interface TripRouteStop {
  nodeId: string;
  nodeName?: string;
  pickup: boolean;
  plannedArrivalTime?: number | string;
  plannedDepartureTime?: number | string;
}
export interface GenerateTripCommand {
  orderIds: string[];
  carrierId: string;
  items: { orderItemId: string; plannedQuantity: Quantity }[];
  orderPickups: { orderId: string; plannedPackageCount: number }[];
  transportOrganizationType: "DIRECT" | "TRANSFER";
  transferNodeId?: string;
  stops: TripRouteStop[];
}
export interface PickupTask {
  contacts: { name: string; phone: string }[];
  carrierName?: string;
  stops: {
    stopId: string;
    stopSeq: number;
    nodeId: string;
    nodeName: string;
    plannedArrivalTime?: number;
    plannedDepartureTime?: number;
    arrivedTime?: number;
    departedTime?: number;
  }[];
  pickupTaskId: string;
  pickupStopId: string;
  taskNo: string;
  transportOrganizationType: "DIRECT" | "TRANSFER";
  tripId: string;
  tripNo?: string;
  carrierId: string;
  pickupNodeId: string;
  pickupAddress: string;
  plannedPackageCount?: number;
  plannedWeightKg?: Quantity;
  plannedVolumeCm3?: Quantity;
  status:
    "PENDING" | "ASSIGNED" | "PARTIALLY_PICKED" | "FINISHED" | "CANCELLED";
  items: {
    destinationNodeId?: string;
    unloadStopId?: string;
    unloadNodeName?: string;
    taskItemId: string;
    orderItemId: string;
    orderId: string;
    orderNo?: string;
    goodsName: string;
    unit: string;
    plannedQuantity: Quantity;
    pickedQuantity: Quantity;
    remainingQuantity: Quantity;
    shortageQuantity?: Quantity;
    shortageReason?: string;
  }[];
}
async function request<T>(
  method: "get" | "post",
  path: string,
  data?: object
): Promise<T> {
  const result = await http.request<Result<T>>(method, `/api/tms${path}`, {
    data
  });
  if (result.code !== 0) throw new Error(result.message || "操作失败");
  return result.data;
}
export const pickupApi = {
  generateTrip: (data: GenerateTripCommand) =>
    request<{ tripId: string; tripNo: string; pickupTaskIds: string[] }>(
      "post",
      "/orders/generate-trip",
      data
    ),
  cancel: (taskId: string) =>
    request<PickupTask>(
      "post",
      `/pickup-tasks/${encodeURIComponent(taskId)}/cancel`
    )
};
