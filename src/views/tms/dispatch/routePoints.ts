import type { LogisticNode } from "@/api/tms";
import type { PickupTask } from "@/api/tmsPickup";

export function buildRoutePoints(
  stops: PickupTask["stops"],
  results: PromiseSettledResult<LogisticNode>[]
) {
  return results.flatMap((result, index) => {
    if (result.status !== "fulfilled" || !stops[index]) return [];
    const node = result.value;
    if (
      !Number.isFinite(node.longitude) ||
      !Number.isFinite(node.latitude) ||
      Math.abs(node.longitude) > 180 ||
      Math.abs(node.latitude) > 90
    )
      return [];
    return [
      {
        nodeId: stops[index].nodeId,
        label: `${stops[index].stopSeq} · ${stops[index].nodeName}`,
        longitude: node.longitude,
        latitude: node.latitude
      }
    ];
  });
}
