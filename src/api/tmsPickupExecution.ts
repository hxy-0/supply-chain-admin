import { http } from "@/utils/http";
import type { Result, PageResult } from "./tms";
import type { Quantity } from "./tmsOrder";
import type { PickupTask } from "./tmsPickup";
export interface PickupContainer {
  containerId: string;
  containerCode: string;
  containerType: string;
  destinationNodeId: string;
  pickupTripId?: string;
  pickupStopId?: string;
  pickupUnloadStopId?: string;
  status: string;
  weightKg?: Quantity;
  volumeCm3?: Quantity;
  items: {
    containerItemId: string;
    taskItemId: string;
    orderItemId: string;
    orderId: string;
    orderNo: string;
    skuId?: number;
    skuCode?: string;
    specText?: string;
    goodsName: string;
    unit: string;
    quantity: Quantity;
    packedQuantity?: Quantity;
    receivedQuantity?: Quantity;
    pickedTime: number;
  }[];
}
export interface PickupConfirmCommand {
  containerCode: string;
  containerType: string;
  weightKg?: Quantity;
  volumeCm3?: Quantity;
  items: { taskItemId: string; quantity: Quantity }[];
}
export interface PickupFinishCommand {
  items: { taskItemId: string; shortageReason?: string }[];
}
async function request<T>(
  method: "get" | "post",
  path: string,
  data?: object
): Promise<T> {
  const result = await http.request<Result<T>>(
    method,
    `/api/tms/pickup-tasks${path}`,
    { data }
  );
  if (result.code !== 0) throw new Error(result.message || "操作失败");
  return result.data;
}
export const pickupExecutionApi = {
  page: (data: object) =>
    request<PageResult<PickupTask>>("post", "/page", data),
  detail: (id: string) =>
    request<PickupTask>("get", `/${encodeURIComponent(id)}`),
  containers: (id: string) =>
    request<PickupContainer[]>("get", `/${encodeURIComponent(id)}/containers`),
  scan: (id: string, containerCode: string) =>
    request<PickupContainer>(
      "get",
      `/${encodeURIComponent(id)}/scan?containerCode=${encodeURIComponent(containerCode)}`
    ),
  confirm: (id: string, command: PickupConfirmCommand) =>
    request<PickupContainer>(
      "post",
      `/${encodeURIComponent(id)}/confirm`,
      command
    ),
  confirmVirtual: (
    id: string,
    command: {
      unloadStopId: string;
      items: { taskItemId: string; quantity: string }[];
    }
  ) =>
    request<PickupContainer>(
      "post",
      `/${encodeURIComponent(id)}/virtual-pallet`,
      command
    ),
  finish: (id: string, command: PickupFinishCommand) =>
    request<PickupTask>("post", `/${encodeURIComponent(id)}/finish`, command)
};
