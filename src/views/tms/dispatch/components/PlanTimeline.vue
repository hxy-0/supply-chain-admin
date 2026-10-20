<script setup lang="ts">
import { computed } from "vue";
import type { PickupTask } from "@/api/tmsPickup";
import { formatDateTime } from "@/utils/date";
import { buildStopSchedule } from "../schedule";

const props = defineProps<{ tasks: PickupTask[]; selectedTaskId?: string }>();
const emit = defineEmits<{ select: [taskId: string] }>();
const schedule = computed(() => buildStopSchedule(props.tasks));
</script>

<template>
  <section class="plan-timeline" aria-label="计划停靠甘特图">
    <header>
      <div>
        <h3>调度时间轴</h3>
        <p>按计划到达与离站时间展示停靠时段，点击选择任务</p>
      </div>
      <span class="timeline-legend">计划停靠</span>
    </header>
    <div v-if="schedule.start !== undefined" class="time-scale">
      <span>{{ formatDateTime(schedule.start) }}</span
      ><span>{{ formatDateTime(schedule.end) }}</span>
    </div>
    <div
      v-for="row in schedule.rows"
      :key="row.id"
      class="timeline-row"
      :class="{ selected: selectedTaskId === row.taskId }"
    >
      <button
        type="button"
        class="row-name"
        :aria-pressed="selectedTaskId === row.taskId"
        @click="emit('select', row.taskId)"
      >
        <strong>{{ row.nodeName }}</strong
        ><small>{{ row.taskNo }}</small>
      </button>
      <div class="row-track">
        <el-tooltip
          v-if="row.left !== undefined"
          :content="`计划到达：${formatDateTime(row.arrival)}；计划离站：${formatDateTime(row.departure)}`"
          placement="top"
        >
          <button
            type="button"
            class="time-bar"
            :class="{ milestone: !row.width }"
            :style="{
              left: `${row.left}%`,
              width: row.width ? `${row.width}%` : undefined
            }"
            :aria-label="`${row.taskNo} ${row.nodeName}，计划到达 ${formatDateTime(row.arrival)}，计划离站 ${formatDateTime(row.departure)}`"
            @click="emit('select', row.taskId)"
          />
        </el-tooltip>
        <span v-else class="unscheduled">{{
          row.invalid ? "离站早于到达，请检查计划" : "尚未设置计划时间"
        }}</span>
      </div>
    </div>
    <el-empty
      v-if="!schedule.rows.length"
      description="添加任务停靠节点后查看时间轴"
      :image-size="60"
    />
  </section>
</template>

<style scoped>
.plan-timeline {
  padding: 24px;
  background: var(--tms-panel);
  border: 1px solid var(--tms-line);
  border-radius: 16px;
}

header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

h3 {
  margin: 0;
  font-size: 16px;
}

p,
small,
.time-scale,
.unscheduled {
  font-size: 11px;
  color: var(--tms-muted);
}

p {
  margin: 8px 0 18px;
}

.timeline-legend {
  font-size: 11px;
  color: var(--tms-accent);
}

.timeline-legend::before {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  content: "";
  background: var(--tms-accent);
  border-radius: 3px;
}

.time-scale {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin: 0 16px 12px 176px;
}

.timeline-row {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  min-height: 60px;
  border-top: 1px solid var(--tms-line);
}

.timeline-row.selected {
  background: var(--tms-accent-soft);
  border-radius: 8px;
}

.row-name {
  padding: 12px;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.row-name strong {
  display: block;
  font-size: 12px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

small {
  display: block;
  margin-top: 6px;
}

.row-track {
  position: relative;
  margin: 0 16px;
  background: repeating-linear-gradient(
    90deg,
    var(--tms-line) 0 1px,
    transparent 1px 25%
  );
}

.time-bar {
  position: absolute;
  top: 22px;
  min-width: 3px;
  height: 16px;
  cursor: pointer;
  background: linear-gradient(90deg, var(--tms-accent), #8d74f2);
  border: 0;
  border-radius: 5px;
}

.time-bar.milestone {
  width: 10px;
  height: 10px;
  margin: 3px 0 0 -5px;
  border-radius: 50%;
}

button:focus-visible {
  outline: 2px solid var(--tms-accent);
  outline-offset: 3px;
}

.unscheduled {
  display: inline-block;
  padding-top: 22px;
}

@media (width <= 700px) {
  .plan-timeline {
    padding: 16px;
  }

  .timeline-row {
    grid-template-columns: 110px minmax(0, 1fr);
  }

  .time-scale {
    flex-wrap: wrap;
    margin-left: 126px;
  }
}
</style>
