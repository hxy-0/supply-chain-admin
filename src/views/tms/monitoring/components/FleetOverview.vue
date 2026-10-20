<script setup lang="ts">
import { computed } from "vue";
import dayjs from "dayjs";
import type { Vehicle, VehicleLocation } from "@/api/tms";
import VehicleWorkbench from "../../fleet/components/VehicleWorkbench.vue";
import { fleetOverview } from "../overview";

const props = defineProps<{
  vehicles: Vehicle[];
  locations: VehicleLocation[];
  loading: boolean;
}>();
const selectedId = defineModel<string>({ default: "" });
const overview = computed(() =>
  fleetOverview(props.vehicles, props.locations, dayjs().format("YYYY-MM-DD"))
);
const metrics = computed(() => [
  { label: "车辆档案总数", value: overview.value.total },
  { label: "在线定位车辆", value: overview.value.online },
  { label: "有行驶速度车辆", value: overview.value.moving },
  { label: "维修中车辆", value: overview.value.maintenance }
]);
</script>

<template>
  <section class="fleet-overview" aria-label="车队总览">
    <div class="tms-metrics" :aria-busy="loading">
      <div v-for="metric in metrics" :key="metric.label" class="tms-metric">
        <span>{{ metric.label }}</span
        ><strong>{{ loading ? "—" : metric.value }}</strong>
      </div>
    </div>
    <div class="tms-panel fleet-hero">
      <VehicleWorkbench
        v-model="selectedId"
        :vehicles="vehicles"
        :carriers="[]"
        :loading="loading"
        readonly
      />
    </div>
    <div class="fleet-bottom">
      <section class="tms-panel">
        <h2>车队状态分布</h2>
        <div
          v-for="status in overview.statuses"
          :key="status.value"
          class="status-row"
        >
          <span>{{ status.label }}</span>
          <div class="status-track">
            <div
              :style="{
                width: `${overview.total ? (status.count / overview.total) * 100 : 0}%`
              }"
            />
          </div>
          <strong>{{ status.count }} 辆</strong>
        </div>
        <p>按车辆档案状态统计，在线定位不等于运输中。</p>
      </section>
      <section class="tms-panel">
        <h2>维护提醒</h2>
        <button
          v-for="reminder in overview.reminders"
          :key="`${reminder.vehicleId}-${reminder.label}`"
          type="button"
          class="maintenance-reminder"
          @click="selectedId = reminder.vehicleId"
        >
          <strong>{{ reminder.plateNumber }}</strong
          ><span>{{ reminder.label }} · {{ reminder.date }}</span
          ><small>查看车辆 →</small></button
        ><el-empty
          v-if="!overview.reminders.length && !loading"
          description="暂无已到期的年检或保险记录"
          :image-size="50"
        />
      </section>
    </div>
  </section>
</template>

<style scoped>
.fleet-hero {
  margin-bottom: 20px;
}

.fleet-bottom {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

h2 {
  margin: 0 0 20px;
  font-size: 16px;
}

p {
  margin: 18px 0 0;
  font-size: 11px;
  color: var(--tms-muted);
}

.status-row {
  display: grid;
  grid-template-columns: 80px 1fr 55px;
  gap: 12px;
  align-items: center;
  margin: 18px 0;
  font-size: 12px;
}

.status-track {
  height: 10px;
  overflow: hidden;
  background: var(--tms-soft);
  border-radius: 10px;
}

.status-track div {
  height: 100%;
  background: var(--tms-accent);
  border-radius: inherit;
}

.status-row:nth-of-type(2) .status-track div {
  background: var(--tms-amber);
}

.status-row:nth-of-type(3) .status-track div {
  background: #ce628e;
}

.status-row:nth-of-type(4) .status-track div {
  background: var(--tms-muted);
}

.maintenance-reminder {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  width: 100%;
  padding: 14px;
  margin: 10px 0;
  text-align: left;
  cursor: pointer;
  background: var(--tms-soft);
  border: 1px solid var(--tms-line);
  border-left: 3px solid var(--tms-amber);
  border-radius: 10px;
}

.maintenance-reminder span {
  font-size: 12px;
  color: var(--tms-amber);
}

small {
  margin-left: auto;
  color: var(--tms-accent);
}

button:focus-visible {
  outline: 2px solid var(--tms-accent);
  outline-offset: 3px;
}

@media (width <= 850px) {
  .fleet-bottom {
    grid-template-columns: 1fr;
  }
}
</style>
