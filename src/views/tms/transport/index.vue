<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import { hasPerms } from "@/utils/auth";
import { formatDateTime } from "@/utils/date";
import { carrierApi, driverApi, vehicleApi } from "@/api/tms";
import type { Carrier, Driver, Vehicle } from "@/api/tms";
import { tripApi, type Trip, type TripStop } from "@/api/tmsTransport";
import type { PickupContainer } from "@/api/tmsPickupExecution";

interface OperateOption {
  containerId: string;
  containerCode: string;
  destinationNodeId?: string;
  items?: PickupContainer["items"];
}

import { tripCargoByOrder } from "./presentation";
defineOptions({ name: "TmsTransport" });

const tripLabels: Record<string, string> = {
  PENDING: "待派车",
  WAITING_LOADING: "待装货",
  WAITING_DEPARTURE: "待发车",
  EXECUTING: "执行中",
  COMPLETED: "已完成",
  CANCELLED: "已取消"
};
const stopLabels: Record<string, string> = {
  PENDING: "未到达",
  ARRIVED: "已签到",
  DEPARTED: "已离站"
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
const operateOpen = ref(false);
const operateTitle = ref("");
const operateStop = ref<TripStop>();
const operateMode = ref<"load" | "unload">("load");
const operateOptions = ref<OperateOption[]>([]);
const operatePicked = ref<string[]>([]);

const canAssign = computed(() => hasPerms("tms:trip:assign"));
const canExecute = computed(() => hasPerms("tms:trip:execute"));
const assignable = computed(
  () =>
    !!trip.value &&
    ["PENDING", "WAITING_LOADING"].includes(trip.value.status) &&
    canAssign.value
);

function failure(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "操作失败");
}

async function load() {
  loading.value = true;
  try {
    const result = await tripApi.page({
      tripNo: tripNo.value || undefined,
      status: status.value || undefined,
      pageNum: page.value,
      pageSize: 20
    });
    rows.value = result.records;
    total.value = Number(result.total ?? 0);
  } catch (reason) {
    failure(reason);
  } finally {
    loading.value = false;
  }
}

async function openDetail(row: Trip) {
  detailOpen.value = true;
  detailLoading.value = true;
  trip.value = undefined;
  try {
    trip.value = await tripApi.detail(row.tripId);
    assignCarrierId.value = trip.value.carrierId ?? "";
    assignVehicleId.value = trip.value.vehicleId ?? "";
    assignDriverId.value = trip.value.driverId ?? "";
    await Promise.all([loadCarriers(), syncAssignOptions()]);
  } catch (reason) {
    failure(reason);
  } finally {
    detailLoading.value = false;
  }
}

async function loadCarriers() {
  if (carriers.value.length) return;
  const result = await carrierApi.page({ pageNum: 1, pageSize: 100 });
  carriers.value = result.records ?? [];
}

/** 已派车的车次按承运人过滤车辆和司机；未派车跟随所选承运人 */
async function syncAssignOptions() {
  if (!trip.value) return;
  const carrierId = trip.value.carrierId || assignCarrierId.value || undefined;
  const vehicleQuery = { pageNum: 1, pageSize: 100, carrierId };
  const driverQuery = { pageNum: 1, pageSize: 100, carrierId };
  const [vehicleResult, driverResult] = await Promise.all([
    vehicleApi.page(vehicleQuery),
    driverApi.page(driverQuery)
  ]);
  vehicles.value = vehicleResult.records ?? [];
  drivers.value = driverResult.records ?? [];
}

async function onAssignCarrierChange() {
  if (trip.value?.carrierId) return;
  await syncAssignOptions();
}

async function run(action: () => Promise<unknown>, message: string) {
  busy.value = true;
  try {
    await action();
    ElMessage.success(message);
    trip.value = await tripApi.detail(trip.value!.tripId);
    assignCarrierId.value = trip.value.carrierId ?? assignCarrierId.value;
  } catch (reason) {
    failure(reason);
  } finally {
    busy.value = false;
  }
}

function assign() {
  if (!trip.value) return;
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

function arrive(stop: TripStop) {
  void run(() => tripApi.arrive(trip.value!.tripId, stop.stopId), "签到完成");
}

function depart(stop: TripStop) {
  ElMessageBox.confirm(
    `确认 ${stop.nodeName} 已完成本点装卸并可离站？`,
    "离站确认",
    { type: "warning" }
  ).then(() => {
    void run(() => tripApi.depart(trip.value!.tripId, stop.stopId), "已离站");
  });
}

/** 装车候选：计划预留 + 本车次提货任务已实提未装车 */
async function openLoad(stop: TripStop) {
  if (!trip.value) return;
  operateStop.value = stop;
  operateMode.value = "load";
  operateTitle.value = `装车 · ${stop.nodeName}`;
  operateOpen.value = true;
  operateOptions.value = [];
  operatePicked.value = [];
  try {
    const loadable = await tripApi.loadable(trip.value.tripId, stop.stopId);
    operateOptions.value = loadable.map(row => ({
      containerId: row.containerId,
      containerCode: row.containerCode,
      destinationNodeId: row.destinationNodeId
    }));
  } catch (reason) {
    failure(reason);
  }
}

/** 卸货候选：在本点卸货的已装容器（整容器卸下） */
function openUnload(stop: TripStop) {
  if (!trip.value) return;
  operateStop.value = stop;
  operateMode.value = "unload";
  operateTitle.value = `卸货 · ${stop.nodeName}`;
  operateOptions.value = trip.value.containers
    .filter(row => row.unloadStopId === stop.stopId && row.status === "LOADED")
    .map(row => ({
      containerId: row.containerId,
      containerCode: row.containerCode,
      destinationNodeId: row.destinationNodeId,
      items: row.items
    }));
  operatePicked.value = [];
}

async function submitOperate() {
  if (!trip.value || !operateStop.value) return;
  if (!operatePicked.value.length) {
    ElMessage.warning("请勾选容器");
    return;
  }
  const stopId = operateStop.value.stopId;
  const containerIds = operatePicked.value;
  const action =
    operateMode.value === "load"
      ? () => tripApi.load(trip.value!.tripId, stopId, containerIds)
      : () => tripApi.unload(trip.value!.tripId, stopId, containerIds);
  operateOpen.value = false;
  await run(action, operateMode.value === "load" ? "已装车" : "已卸货");
}

function completeTrip() {
  ElMessageBox.confirm(
    "全部停靠点已离站且容器卸空，确认完成本车次？",
    "完成车次",
    { type: "warning" }
  ).then(() => {
    void run(() => tripApi.complete(trip.value!.tripId), "车次已完成");
  });
}

onMounted(() => void load());
</script>

<template>
  <div class="tms-workspace">
    <header class="transport-header">
      <div>
        <h2>车次执行</h2>
        <p>
          派车、签到、装车、发车、卸货、离站；中途卸货只结束对应容器的运输关系。
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
              >执行详情</el-button
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
      :title="trip ? `车次 ${trip.tripNo}` : '车次执行'"
      width="1100px"
      :busy="busy || detailLoading"
      readonly
    >
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
              >确认派车</el-button
            >
          </div>
          <p class="assign-tip">
            车辆和司机必须属于所选承运人；派车后车次进入待装货。
          </p>
        </div>

        <div class="flex-bc mt-4 mb-2">
          <strong>停靠点作业</strong>
          <el-button
            v-if="trip.status === 'EXECUTING' && canExecute"
            type="primary"
            :loading="busy"
            @click="completeTrip"
            >完成车次</el-button
          >
        </div>
        <el-table :data="trip.stops" border>
          <el-table-column prop="stopSeq" label="序" width="60" />
          <el-table-column prop="nodeName" label="节点" min-width="160" />
          <el-table-column label="计划到达" width="170"
            ><template #default="{ row }">{{
              formatDateTime(row.plannedArrivalTime)
            }}</template></el-table-column
          >
          <el-table-column label="计划发车" width="170"
            ><template #default="{ row }">{{
              formatDateTime(row.plannedDepartureTime)
            }}</template></el-table-column
          >
          <el-table-column label="实际签到" width="170"
            ><template #default="{ row }">{{
              formatDateTime(row.arrivedTime)
            }}</template></el-table-column
          >
          <el-table-column label="实际离站" width="170"
            ><template #default="{ row }">{{
              formatDateTime(row.departedTime)
            }}</template></el-table-column
          >
          <el-table-column label="状态" width="90"
            ><template #default="{ row }">{{
              stopLabels[row.status as keyof typeof stopLabels] ?? row.status
            }}</template></el-table-column
          >
          <el-table-column
            v-if="
              canExecute &&
              trip &&
              !['COMPLETED', 'CANCELLED'].includes(trip.status)
            "
            label="作业"
            width="230"
            fixed="right"
            ><template #default="{ row }">
              <el-button
                link
                type="primary"
                :disabled="busy || row.status !== 'PENDING'"
                @click="arrive(row as TripStop)"
                >签到</el-button
              >
              <el-button
                link
                type="primary"
                :disabled="busy || row.status !== 'ARRIVED'"
                @click="openLoad(row as TripStop)"
                >装车</el-button
              >
              <el-button
                link
                type="primary"
                :disabled="busy || row.status !== 'ARRIVED'"
                @click="openUnload(row as TripStop)"
                >卸货</el-button
              >
              <el-button
                link
                type="danger"
                :disabled="busy || row.status !== 'ARRIVED'"
                @click="depart(row as TripStop)"
                >离站</el-button
              ></template
            ></el-table-column
          >
        </el-table>

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
          <el-table-column label="作业">
            <template #default="{ row }">
              <el-button
                v-if="canExecute"
                link
                type="primary"
                :disabled="
                  busy ||
                  !trip.stops.some(
                    stop =>
                      stop.stopId === row.stopId && stop.status === 'ARRIVED'
                  ) ||
                  ['FINISHED', 'CANCELLED'].includes(row.status)
                "
                @click="
                  openUnload(
                    trip.stops.find(stop => stop.stopId === row.stopId)!
                  )
                "
                >卸货</el-button
              >
            </template>
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
                <el-table-column prop="quantity" label="本板数量" />
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

    <BusinessDialog
      v-model="operateOpen"
      :title="operateTitle"
      width="720px"
      :busy="busy"
      @submit="submitOperate"
    >
      <el-table
        :data="operateOptions"
        border
        empty-text="该停靠点暂无候选容器"
        @selection-change="
          (picked: Array<{ containerId: string }>) =>
            (operatePicked = picked.map(row => row.containerId))
        "
      >
        <el-table-column type="selection" width="44" />
        <el-table-column prop="containerCode" label="容器码" min-width="150" />
        <el-table-column
          v-if="operateMode === 'load'"
          prop="destinationNodeId"
          label="最终目的地"
          min-width="160"
        />
        <el-table-column v-else label="商品" min-width="220"
          ><template #default="{ row }"
            >{{ row.items?.length ?? 0 }} 项 ·
            {{ row.items?.map(item => item.goodsName).join("、") }}</template
          ></el-table-column
        >
      </el-table>
      <p class="assign-tip">
        {{
          operateMode === "load"
            ? "容器整板装车；到站签到后才能装车，离站前须装完本点计划容器。"
            : "整容器卸货并逐项确认商品数量；最终目的地卸货生成订单完成记录。"
        }}
      </p>
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
