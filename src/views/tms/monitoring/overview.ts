import type { Vehicle, VehicleLocation } from "@/api/tms";
import { enumCode, vehicleStatuses } from "../fleet/definitions";

export function fleetOverview(
  vehicles: Vehicle[],
  locations: VehicleLocation[],
  today: string
) {
  const statuses = vehicleStatuses.map(status => ({
    ...status,
    count: vehicles.filter(
      vehicle => enumCode(vehicle.status, vehicleStatuses) === status.value
    ).length
  }));
  const reminders = vehicles.flatMap(vehicle =>
    [
      { label: "年检到期", date: vehicle.inspectionExpiryDate },
      { label: "保险到期", date: vehicle.insuranceExpiryDate }
    ]
      .filter(
        item =>
          item.date &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
          item.date <= today
      )
      .map(item => ({
        ...item,
        vehicleId: vehicle.id,
        plateNumber: vehicle.plateNumber
      }))
  );
  return {
    statuses,
    reminders,
    total: vehicles.length,
    online: new Set(locations.map(location => location.vehicleId)).size,
    moving: new Set(
      locations
        .filter(
          location =>
            Number.isFinite(location.speedKph) && location.speedKph > 0
        )
        .map(location => location.vehicleId)
    ).size,
    maintenance:
      statuses.find(status => status.name === "MAINTENANCE")?.count || 0
  };
}
