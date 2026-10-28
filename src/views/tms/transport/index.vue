<script setup lang="ts">
import { computed, ref, shallowRef, watch, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import { hasPerms } from "@/utils/auth";
import { formatDateTime } from "@/utils/date";
import { carrierApi, driverApi, vehicleApi } from "@/api/tms";
import type { Carrier, Driver, Vehicle } from "@/api/tms";
import { tripApi, type Trip } from "@/api/tmsTransport";
import TripRouteProgress from "./components/TripRouteProgress.vue";

import { tripCargoByOrder } from "./presentation";
defineOptions({ name: "TmsTransport" });

const tripLabels: Record<string, string> = {
  PENDING_ASSIGNMENT: "待指派",
  PENDING_EXECUTION: "待司机接收",
  WAITING_DEPARTURE: "待发车",
  IN_TRANSIT: "运输中",
  DELIVERED: "已送达",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};
const cargoLabels: Record<string, string> = {
  RESERVED: "已预留",
  LOADED: "已装车",
  UNLOADED: "已卸货"
};

const rows = ref<Trip[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const busy = ref(false);
const tripNo = ref("");
const route = useRoute();
const status = ref("");

const detailOpen = ref(false);
const detailLoading = ref(false);
const trip = ref<Trip>();
const cargoView = ref("pallet");
const orderCargo = computed(() =>
  tripCargoByOrder(trip.value?.containers || [])
);
const carriers = ref<Carrier[]>([]);
const vehicles = ref<Vehicle[]>([]);
const drivers = ref<Driver[]>([]);
const assignCarrierId = ref("");
const assignVehicleId = ref("");
const assignDriverId = ref("");
const detailError = shallowRef("");
let listVersion = 0,
  detailVersion = 0,
  optionVersion = 0;
const canAssign = computed(() => hasPerms("tms:trip:assign"));
const assignable = computed(
  () =>
    !!trip.value &&
    ["PENDING_ASSIGNMENT", "PENDING_EXECUTION"].includes(trip.value.status) &&
    canAssign.value
);

function failure(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "操作失败");
}

async function load() {
  const current = ++listVersion;
  loading.value = true;
  try {
    const result = await tripApi.page({
      tripNo: tripNo.value || undefined,
      status: status.value || undefined,
      pageNum: page.value,
      pageSize: 20
    });
    if (current !== listVersion) {
      return;
    }
    rows.value = result.records;
    total.value = Number(result.total ?? 0);
  } catch (reason) {
    if (current === listVersion) {
      rows.value = [];
      total.value = 0;
      failure(reason);
    }
  } finally {
    if (current === listVersion) {
      loading.value = false;
    }
  }
}

async function openDetail(row: Trip) {
  const current = ++detailVersion;
  detailOpen.value = true;
  detailLoading.value = true;
  trip.value = undefined;
  detailError.value = "";
  try {
    const record = await tripApi.detail(row.tripId);
    if (current !== detailVersion || !detailOpen.value) {
      return;
    }
    trip.value = record;
    assignCarrierId.value = trip.value.carrierId ?? "";
    assignVehicleId.value = trip.value.vehicleId ?? "";
    assignDriverId.value = trip.value.driverId ?? "";
    if (assignable.value) {
      await Promise.all([loadCarriers(), syncAssignOptions()]);
    }
  } catch (reason) {
    if (current === detailVersion) {
      detailError.value =
        reason instanceof Error ? reason.message : "车次详情加载失败";
    }
  } finally {
    if (current === detailVersion) {
      detailLoading.value = false;
    }
  }
}

async function loadCarriers() {
  if (carriers.value.length) return;
  const result = await carrierApi.page({ pageNum: 1, pageSize: 100 });
  carriers.value = result.records ?? [];
}

/** 已派车的车次按承运人过滤车辆和司机；未派车跟随所选承运人 */
async function syncAssignOptions() {
  const current = ++optionVersion;
  if (!trip.value) return;
  const carrierId = trip.value.carrierId || assignCarrierId.value || undefined;
  vehicles.value = [];
  drivers.value = [];
  if (!carrierId) {
    return;
  }
  const vehicleQuery = { pageNum: 1, pageSize: 100, carrierId };
  const driverQuery = { pageNum: 1, pageSize: 100, carrierId };
  const [vehicleResult, driverResult] = await Promise.all([
    vehicleApi.page(vehicleQuery),
    driverApi.page(driverQuery)
  ]);
  if (current !== optionVersion || !detailOpen.value) {
    return;
  }
  vehicles.value = vehicleResult.records ?? [];
  drivers.value = driverResult.records ?? [];
}

async function onAssignCarrierChange() {
  if (trip.value?.carrierId) return;
  assignVehicleId.value = "";
  assignDriverId.value = "";
  try {
    await syncAssignOptions();
  } catch (reason) {
    failure(reason);
  }
}

async function run(action: () => Promise<unknown>, message: string) {
  if (busy.value) {
    return false;
  }
  busy.value = true;
  try {
    await action();
    ElMessage.success(message);
    trip.value = await tripApi.detail(trip.value!.tripId);
    assignCarrierId.value = trip.value.carrierId ?? assignCarrierId.value;
    await load();
    return true;
  } catch (reason) {
    failure(reason);
    return false;
  } finally {
    busy.value = false;
  }
}

function assign() {
  if (!trip.value || !assignable.value || busy.value) return;
  if (!assignVehicleId.value || !assignDriverId.value) {
    ElMessage.warning("请选择车辆和司机");
    return;
  }
  void run(
    () =>
      tripApi.assign(trip.value!.tripId, {
        carrierId: assignCarrierId.value || undefined,
        vehicleId: assignVehicleId.value,
        driverId: assignDriverId.value
      }),
    "派车完成"
  );
}

async function cancelTrip() {
  if (!trip.value || busy.value || !canAssign.value) {
    return;
  }
  try {
    await ElMessageBox.confirm("确认取消该未发车车次？", "取消车次");
    await run(() => tripApi.cancel(trip.value!.tripId), "车次已取消");
  } catch (reason) {
    if (reason !== "cancel" && reason !== "close") {
      failure(reason);
    }
  }
}

watch(
  () => route.query.tripNo,
  value => {
    tripNo.value = typeof value === "string" ? value : "";
    page.value = 1;
    void load();
  },
  { immediate: true }
);
watch(detailOpen, visible => {
  if (!visible) {
    detailVersion++;
    optionVersion++;
  }
});
onUnmounted(() => {
  listVersion++;
  detailVersion++;
  optionVersion++;
});
</script>

<template>
  <div class="tms-workspace">
    <header class="transport-header">
      <div>
        <h2>车次管理</h2>
        <p>
          统一指派车辆和司机，跟进每站运输进度；接收、发车、签到与装卸由司机在小程序完成。
        </p>
      </div>
    </header>
    <section class="tms-panel">
      <div class="toolbar">
        <el-input
          v-model="tripNo"
          placeholder="车次号"
          clearable
          class="filter"
          @keyup.enter="
            page = 1;
            load();
          "
        />
        <el-select
          v-model="status"
          placeholder="车次状态"
          clearable
          class="filter"
          @change="
            page = 1;
            load();
          "
        >
          <el-option
            v-for="(label, key) in tripLabels"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>
        <el-button
          @click="
            page = 1;
            load();
          "
          >查询</el-button
        >
      </div>
      <el-table v-loading="loading" :data="rows" border>
        <el-table-column prop="tripNo" label="车次号" min-width="150" />
        <el-table-column label="状态" width="110"
          ><template #default="{ row }">{{
            tripLabels[row.status as keyof typeof tripLabels] ?? row.status
          }}</template></el-table-column
        >
        <el-table-column prop="carrierName" label="承运人" min-width="140" />
        <el-table-column prop="plateNumber" label="车牌" width="110" />
        <el-table-column prop="driverName" label="司机" width="110" />
        <el-table-column label="计划发车" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.plannedDepartureTime)
          }}</template></el-table-column
        >
        <el-table-column label="实际发车" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.actualDepartureTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="100" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="openDetail(row as Trip)"
              >查看车次</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="page"
        :total="total"
        :page-size="20"
        layout="total, prev, pager, next"
        class="mt-3"
        @current-change="load"
      />
    </section>

    <BusinessDialog
      v-model="detailOpen"
      :title="trip ? `车次 ${trip.tripNo}` : '车次详情'"
      width="1100px"
      :busy="busy || detailLoading"
      readonly
    >
      <el-alert
        v-if="detailError"
        :title="detailError"
        type="error"
        :closable="false"
      />
      <div v-if="trip" v-loading="detailLoading">
        <el-descriptions :column="4" border>
          <el-descriptions-item label="状态">{{
            tripLabels[trip.status]
          }}</el-descriptions-item>
          <el-descriptions-item label="承运人">{{
            trip.carrierName || "未派车"
          }}</el-descriptions-item>
          <el-descriptions-item label="车辆">{{
            trip.plateNumber || "—"
          }}</el-descriptions-item>
          <el-descriptions-item label="司机">{{
            trip.driverName || "—"
          }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="assignable" class="assign-card">
          <strong>派车</strong>
          <div class="assign-row">
            <el-select
              v-model="assignCarrierId"
              placeholder="承运人"
              :disabled="!!trip.carrierId"
              class="assign-select"
              @change="onAssignCarrierChange"
            >
              <el-option
                v-for="carrier in carriers"
                :key="carrier.id"
                :label="carrier.name"
                :value="carrier.id"
              />
            </el-select>
            <el-select
              v-model="assignVehicleId"
              placeholder="车辆"
              class="assign-select"
            >
              <el-option
                v-for="vehicle in vehicles"
                :key="vehicle.id"
                :label="vehicle.plateNumber"
                :value="vehicle.id"
              />
            </el-select>
            <el-select
              v-model="assignDriverId"
              placeholder="司机"
              filterable
              class="assign-select"
            >
              <el-option
                v-for="driver in drivers"
                :key="driver.id"
                :label="`${driver.name} ${driver.phone}`"
                :value="driver.id"
              />
            </el-select>
            <el-button
              type="primary"
              :loading="busy"
              :disabled="detailLoading"
              @click="assign"
              >确认指派</el-button
            >
          </div>
          <p class="assign-tip">
            车辆和司机必须属于所选承运人；指派后车次进入待执行，司机接收确认后进入待发车。
          </p>
        </div>

        <div class="flex-bc mt-4 mb-2">
          <strong>路线与停靠进度</strong>
          <el-button
            v-if="
              canAssign &&
              [
                'PENDING_ASSIGNMENT',
                'PENDING_EXECUTION',
                'WAITING_DEPARTURE'
              ].includes(trip.status)
            "
            type="danger"
            :disabled="busy"
            @click="cancelTrip"
            >取消车次</el-button
          >
        </div>
        <TripRouteProgress :trip="trip" />

        <h3 class="mt-4 mb-2 font-semibold">卸货任务（按卸货点聚合）</h3>
        <el-table :data="trip.unloadingTasks" border empty-text="暂无卸货任务">
          <el-table-column type="expand">
            <template #default="{ row }">
              <el-table :data="row.items" border>
                <el-table-column
                  prop="orderNo"
                  label="来源订单"
                  min-width="180"
                />
                <el-table-column prop="goodsName" label="商品" />
                <el-table-column prop="unit" label="单位" />
                <el-table-column prop="plannedQuantity" label="计划卸货量" />
                <el-table-column prop="pickedQuantity" label="实际提货量" />
                <el-table-column prop="unloadedQuantity" label="已卸货量" />
              </el-table>
            </template>
          </el-table-column>
          <el-table-column prop="nodeName" label="卸货点" />
          <el-table-column label="状态">
            <template #default="{ row }">{{
              {
                PENDING: "待卸货",
                PARTIALLY_UNLOADED: "部分卸货",
                FINISHED: "已结束",
                CANCELLED: "已取消"
              }[row.status]
            }}</template>
          </el-table-column>
        </el-table>
        <div class="flex-bc mt-4 mb-2">
          <strong>随车货物</strong>
          <el-radio-group v-model="cargoView">
            <el-radio-button value="pallet">按托盘</el-radio-button>
            <el-radio-button value="order">按订单</el-radio-button>
          </el-radio-group>
        </div>
        <el-table
          v-if="cargoView === 'pallet'"
          :data="trip.containers"
          border
          empty-text="暂无随车托盘"
        >
          <el-table-column type="expand"
            ><template #default="{ row }">
              <el-table :data="row.items" border>
                <el-table-column
                  prop="orderNo"
                  label="来源订单"
                  min-width="200"
                />
                <el-table-column prop="goodsName" label="商品" />
                <el-table-column prop="quantity" label="实际装货数量" />
                <el-table-column prop="receivedQuantity" label="实际卸货数量" />
                <el-table-column prop="unit" label="单位" />
              </el-table> </template
          ></el-table-column>
          <el-table-column
            prop="containerType"
            label="托盘 / 容器类型"
            min-width="130"
          />
          <el-table-column
            prop="containerCode"
            label="托盘 / 容器号"
            min-width="220"
          />
          <el-table-column
            prop="destinationNodeName"
            label="最终目的地"
            min-width="130"
          />
          <el-table-column label="装货点" min-width="130"
            ><template #default="{ row }">{{
              row.loadNodeName || "—"
            }}</template></el-table-column
          >
          <el-table-column label="卸货点" min-width="130"
            ><template #default="{ row }">{{
              row.unloadNodeName || "—"
            }}</template></el-table-column
          >
          <el-table-column label="本段状态" width="100"
            ><template #default="{ row }">{{
              cargoLabels[row.status as keyof typeof cargoLabels] ?? row.status
            }}</template></el-table-column
          >
          <el-table-column label="商品" min-width="220"
            ><template #default="{ row }"
              >{{ row.items?.length ?? 0 }} 项 ·
              {{ row.items?.map(item => item.goodsName).join("、") }}</template
            ></el-table-column
          >
        </el-table>
        <div v-else>
          <el-empty v-if="!orderCargo.length" description="暂无随车订单商品" />
          <section
            v-for="order in orderCargo"
            :key="order.orderId"
            class="mt-4"
          >
            <h4 class="mb-2 font-semibold">订单 {{ order.orderNo }}</h4>
            <el-table :data="order.items" border>
              <el-table-column prop="goodsName" label="商品" min-width="160" />
              <el-table-column prop="unit" label="单位" width="80" />
              <el-table-column
                prop="quantity"
                label="本车次合计数量"
                min-width="150"
              />
              <el-table-column label="托盘分配" min-width="300"
                ><template #default="{ row }">
                  <div
                    v-for="allocation in row.allocations"
                    :key="allocation.containerId"
                  >
                    {{ allocation.containerType }} ·
                    {{ allocation.containerCode }}：{{ allocation.quantity }}
                    {{ row.unit }}（{{ cargoLabels[allocation.status] }}）
                  </div>
                </template></el-table-column
              >
            </el-table>
          </section>
        </div>
      </div>
      <template #footer
        ><el-button :disabled="busy" @click="detailOpen = false"
          >关闭</el-button
        ></template
      >
    </BusinessDialog>
  </div>
</template>

<style scoped>
.transport-header {
  margin-bottom: 16px;
}

.transport-header h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.transport-header p {
  margin: 0;
  font-size: 13px;
  color: var(--tms-muted);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.filter {
  width: 200px;
}

.assign-card {
  padding: 14px;
  margin-top: 16px;
  border: 1px solid var(--tms-line);
  border-radius: 8px;
}

.assign-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 10px;
}

.assign-select {
  width: 220px;
}

.assign-tip {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--tms-muted);
}
</style>
