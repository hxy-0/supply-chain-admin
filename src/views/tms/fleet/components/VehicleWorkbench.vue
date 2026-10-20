<script setup lang="ts">
import { computed, useId } from "vue";
import type { Vehicle } from "@/api/tms";
import {
  enumCode,
  optionLabel,
  vehicleStatuses,
  vehicleTypes
} from "../definitions";

const props = defineProps<{
  vehicles: Vehicle[];
  carriers: { id: string; name: string }[];
  loading: boolean;
  readonly?: boolean;
  detailOnly?: boolean;
}>();
const emit = defineEmits<{ edit: [vehicle: Vehicle] }>();
const selectedId = defineModel<string>({ default: "" });
const selected = computed(
  () =>
    props.vehicles.find(vehicle => vehicle.id === selectedId.value) ||
    props.vehicles[0]
);
const illustrationId = useId();
const flatbed = computed(
  () => enumCode(selected.value?.vehicleType, vehicleTypes) === 1
);
const carrier = computed(
  () =>
    props.carriers.find(item => item.id === selected.value?.carrierId)?.name ||
    (selected.value?.carrierId ? "承运商资料未加载" : "未设置承运商")
);
</script>

<template>
  <div
    v-loading="loading"
    class="vehicle-workbench"
    :class="{ 'detail-only': detailOnly }"
  >
    <nav v-if="!detailOnly" class="vehicle-list" aria-label="车辆选择">
      <button
        v-for="vehicle in vehicles"
        :key="vehicle.id"
        type="button"
        :class="{ selected: selected?.id === vehicle.id }"
        :aria-pressed="selected?.id === vehicle.id"
        @click="selectedId = vehicle.id"
      >
        <div class="vehicle-card-heading">
          <strong>{{ vehicle.plateNumber }}</strong
          ><span class="tms-status" :data-status="vehicle.status">{{
            optionLabel(vehicle.status, vehicleStatuses)
          }}</span>
        </div>
        <p>{{ optionLabel(vehicle.vehicleType, vehicleTypes) }}</p>
        <div class="vehicle-card-meta">
          <span
            >额定载重
            <b>{{
              vehicle.loadCapacity == null
                ? "未知"
                : `${vehicle.loadCapacity} 吨`
            }}</b></span
          ><span
            >额定容积
            <b>{{
              vehicle.volumeCapacity == null
                ? "未知"
                : `${vehicle.volumeCapacity} m³`
            }}</b></span
          >
        </div>
      </button>
      <el-empty v-if="!vehicles.length && !loading" description="暂无车辆" />
    </nav>
    <section v-if="selected" class="vehicle-profile">
      <div class="vehicle-profile-heading">
        <div>
          <small>车辆档案</small>
          <h2>{{ selected.plateNumber }}</h2>
          <p>{{ carrier }}</p>
        </div>
        <el-button v-if="!readonly" @click="emit('edit', selected)"
          >编辑档案</el-button
        >
      </div>
      <div class="vehicle-illustration">
        <svg
          viewBox="0 0 650 215"
          role="img"
          :aria-label="`${selected.plateNumber}车辆示意`"
        >
          <defs>
            <linearGradient
              :id="`${illustrationId}-body`"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0" stop-color="#ffffff" />
              <stop offset="1" stop-color="#dbe2ee" />
            </linearGradient>
            <linearGradient
              :id="`${illustrationId}-cargo`"
              x1="0"
              y1="0"
              x2="1"
              y2="1"
            >
              <stop
                offset="0"
                stop-color="var(--tms-accent)"
                stop-opacity=".75"
              />
              <stop
                offset="1"
                stop-color="var(--tms-accent)"
                stop-opacity=".28"
              />
            </linearGradient>
          </defs>
          <ellipse
            cx="329"
            cy="202"
            rx="294"
            ry="8"
            fill="#263655"
            opacity=".08"
          />
          <path
            d="M25 157V119Q25 111 37 106L72 87 107 40Q112 34 123 34H169Q177 34 177 44V176H25Z"
            :fill="`url(#${illustrationId}-body)`"
            stroke="#a9b5c9"
            stroke-width="2"
          />
          <path d="M111 49H153V100H84Z" fill="#9fbdd1" stroke="#7c9db6" />
          <path d="M114 52H148L88 96Z" fill="#d4e4ed" opacity=".7" />
          <path
            d="M159 52V135H101M159 112H149M42 123H64M35 155H73"
            fill="none"
            stroke="#a0aec3"
            stroke-width="3"
          />
          <rect x="26" y="136" width="14" height="9" rx="2" fill="#ffd082" />
          <rect x="169" y="57" width="9" height="29" rx="3" fill="#536580" />
          <path d="M177 159H621V175H177Z" fill="#66778f" />
          <g v-if="flatbed">
            <path
              d="M181 146H619V160H181Z"
              :fill="`url(#${illustrationId}-body)`"
              stroke="#a9b5c9"
              stroke-width="2"
            />
            <path
              v-for="x in [190, 275, 360, 445, 530, 610]"
              :key="x"
              :d="`M${x} 147V164`"
              stroke="#a9b5c9"
              stroke-width="3"
            />
            <path
              d="M185 128H617"
              stroke="var(--tms-accent)"
              stroke-width="2"
              stroke-dasharray="4 5"
              opacity=".45"
            />
          </g>
          <g v-else>
            <rect
              x="182"
              y="29"
              width="436"
              height="127"
              rx="5"
              :fill="`url(#${illustrationId}-body)`"
              stroke="#a9b5c9"
              stroke-width="2"
            />
            <rect
              x="190"
              y="37"
              width="420"
              height="111"
              rx="2"
              :fill="`url(#${illustrationId}-cargo)`"
            />
            <path
              v-for="x in [
                207, 245, 283, 321, 359, 397, 435, 473, 511, 549, 587
              ]"
              :key="x"
              :d="`M${x} 40V145`"
              stroke="#ffffff"
              opacity=".18"
            />
            <path d="M605 35V150" stroke="#96a5bd" stroke-width="2" />
          </g>
          <rect x="616" y="139" width="5" height="14" rx="1" fill="#ec7b86" />
          <path d="M31 170H624" stroke="#a8b4c7" stroke-width="3" />
          <g v-for="x in [85, 220, 521, 573]" :key="x">
            <circle :cx="x" cy="175" r="25" fill="#263247" />
            <circle
              :cx="x"
              cy="175"
              r="20"
              fill="none"
              stroke="#46536a"
              stroke-width="2"
            />
            <circle
              :cx="x"
              cy="175"
              r="13"
              fill="#d6deeb"
              stroke="#94a2b7"
              stroke-width="2"
            />
            <circle :cx="x" cy="175" r="5" fill="#7e8ea5" />
          </g>
          <text
            x="397"
            :y="flatbed ? 83 : 87"
            text-anchor="middle"
            fill="var(--tms-ink)"
            font-size="22"
            font-weight="600"
          >
            {{ optionLabel(selected.vehicleType, vehicleTypes) }}
          </text>
          <text
            x="397"
            :y="flatbed ? 107 : 117"
            text-anchor="middle"
            fill="var(--tms-muted)"
            font-size="13"
          >
            {{ selected.plateNumber }} · 车辆示意
          </text>
        </svg>
      </div>
      <div class="vehicle-specs">
        <div>
          <span>车辆状态</span
          ><strong>{{ optionLabel(selected.status, vehicleStatuses) }}</strong>
        </div>
        <div>
          <span>额定载重</span
          ><strong>{{
            selected.loadCapacity == null
              ? "未知"
              : `${selected.loadCapacity} 吨`
          }}</strong>
        </div>
        <div>
          <span>额定容积</span
          ><strong>{{
            selected.volumeCapacity == null
              ? "未知"
              : `${selected.volumeCapacity} m³`
          }}</strong>
        </div>
      </div>
      <h3>档案与维护</h3>
      <el-descriptions :column="2">
        <el-descriptions-item label="车辆长度">{{
          selected.vehicleLength == null
            ? "未登记"
            : `${selected.vehicleLength} 米`
        }}</el-descriptions-item>
        <el-descriptions-item label="购置日期">{{
          selected.purchaseDate || "未登记"
        }}</el-descriptions-item>
        <el-descriptions-item label="年检到期">{{
          selected.inspectionExpiryDate || "未登记"
        }}</el-descriptions-item>
        <el-descriptions-item label="保险到期">{{
          selected.insuranceExpiryDate || "未登记"
        }}</el-descriptions-item>
      </el-descriptions>
    </section>
  </div>
</template>

<style scoped>
.vehicle-workbench.detail-only {
  grid-template-columns: 1fr;
}

.vehicle-workbench {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 28px;
}

.vehicle-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 660px;
  overflow: auto;
}

button {
  padding: 20px;
  text-align: left;
  cursor: pointer;
  background: var(--tms-panel);
  border: 1px solid var(--tms-line);
  border-radius: 12px;
}

button.selected {
  background: var(--tms-accent-soft);
  border-color: var(--tms-accent);
}

button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.vehicle-card-heading,
.vehicle-profile-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.vehicle-card-heading span,
small,
p,
.vehicle-specs span {
  font-size: 12px;
  color: var(--tms-muted);
}

p {
  margin-top: 12px;
}

.vehicle-card-meta {
  display: flex;
  gap: 18px;
  margin-top: 24px;
  font-size: 11px;
  color: var(--tms-muted);
}

.vehicle-card-meta b {
  display: block;
  margin-top: 5px;
  font-size: 16px;
  font-weight: 500;
  color: var(--tms-ink);
}

.vehicle-profile {
  min-width: 0;
  padding: 24px;
  background: linear-gradient(
    145deg,
    var(--tms-accent-soft),
    var(--tms-soft) 65%
  );
  border-radius: 16px;
}

h2 {
  margin: 8px 0;
  font-size: 27px;
  font-weight: 500;
}

h3 {
  margin: 26px 0 16px;
  font-size: 15px;
}

.vehicle-illustration {
  padding: 32px 0 24px;
}

svg {
  width: 100%;
}

.vehicle-specs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.vehicle-specs div {
  padding: 16px;
  background: var(--tms-panel);
  border-radius: 10px;
}

.vehicle-specs strong {
  display: block;
  margin-top: 10px;
  font-size: 18px;
  font-weight: 500;
}

@media (width <= 850px) {
  .vehicle-workbench {
    grid-template-columns: 1fr;
  }

  .vehicle-list {
    flex-direction: row;
  }

  button {
    min-width: 230px;
  }
}
</style>
