<script setup lang="ts">
import { ref, shallowRef, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { arrivalApi, arrivalStatuses, inboundApi } from "@/api/wmsInbound";
import type { Arrival, InboundOrder, InboundItem } from "@/api/wmsInbound";
import { warehouseApi } from "@/api/wms";
import type { Warehouse } from "@/api/wms";
import type { Id } from "@/api/pms";
import { tripApi } from "@/api/tmsTransport";
import type { Trip } from "@/api/tmsTransport";
import { formatDateTime } from "@/utils/date";
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ changed: [] }>();
const warehouses = ref<Warehouse[]>([]);
const warehouseId = shallowRef<Id>();
const tripId = shallowRef<string>();
const tripOptions = ref<Trip[]>([]);
const arrivalTime = shallowRef(Date.now());
const records = ref<Arrival[]>([]);
const orders = ref<InboundOrder[]>([]);
const lines = ref<
  { id: Id; label: string; expectedQuantity: number; maximum: number }[]
>([]);
const search = shallowRef("");
const tripNo = shallowRef("");
const page = shallowRef(1);
const total = shallowRef(0);
const orderPage = shallowRef(1);
const orderTotal = shallowRef(0);
const loading = shallowRef(false);
const saving = shallowRef(false);
let version = 0;
async function load(reset = false) {
  const current = ++version;
  if (reset) page.value = 1;
  records.value = [];
  if (!warehouseId.value) return;
  loading.value = true;
  try {
    const result = await arrivalApi.page({
      warehouseId: warehouseId.value,
      tripNo: tripNo.value,
      pageNum: page.value,
      pageSize: 10
    });
    if (current === version) {
      records.value = result.records;
      total.value = Number(result.total);
    }
  } catch (error) {
    if (current === version)
      ElMessage.error(error instanceof Error ? error.message : "到货加载失败");
  } finally {
    if (current === version) loading.value = false;
  }
}
let searchVersion = 0;
async function searchOrders(reset = false) {
  const current = ++searchVersion;
  if (reset) orderPage.value = 1;
  orders.value = [];
  if (!warehouseId.value) return;
  try {
    const result = await inboundApi.page({
      warehouseId: warehouseId.value,
      inboundNo: search.value,
      pageNum: orderPage.value,
      pageSize: 10
    });
    if (current === searchVersion) {
      orders.value = result.records;
      orderTotal.value = Number(result.total);
    }
  } catch (error) {
    if (current === searchVersion)
      ElMessage.error(
        error instanceof Error ? error.message : "入库单加载失败"
      );
  }
}
let tripVersion = 0;
async function searchTrips(tripNo = "") {
  const current = ++tripVersion;
  try {
    const result = await tripApi.page({ tripNo, pageNum: 1, pageSize: 50 });
    if (current === tripVersion)
      tripOptions.value = result.records.filter(
        item => item.status !== "CANCELLED"
      );
  } catch (error) {
    if (current === tripVersion)
      ElMessage.error(error instanceof Error ? error.message : "车次加载失败");
  }
}
function add(order: InboundOrder, item: InboundItem) {
  if (lines.value.some(row => String(row.id) === String(item.id))) return;
  lines.value.push({
    id: item.id,
    label:
      order.inboundNo +
      " / " +
      (order.sourceNo || "手工") +
      " / 行" +
      item.sourceLineNo +
      " / " +
      item.skuName,
    expectedQuantity: Number(item.unassignedQuantity),
    maximum: Number(item.unassignedQuantity)
  });
}
async function create() {
  if (saving.value) return;
  if (!warehouseId.value || !lines.value.length || !arrivalTime.value) {
    ElMessage.error("请选择仓库、到货时间并添加来源行");
    return;
  }
  saving.value = true;
  try {
    await arrivalApi.create({
      warehouseId: warehouseId.value,
      tripId: tripId.value,
      arrivalTime: arrivalTime.value,
      items: lines.value.map(item => ({
        inboundItemId: item.id,
        expectedQuantity: item.expectedQuantity
      }))
    });
    lines.value = [];
    tripId.value = undefined;
    await Promise.all([load(true), searchOrders()]);
    emit("changed");
    ElMessage.success("到货批次已创建，扫码收货后才累计实收数量");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "创建失败");
  } finally {
    saving.value = false;
  }
}
async function cancel(row: Arrival) {
  try {
    await ElMessageBox.confirm(
      "取消尚未收货的批次并释放未收数量？",
      "取消到货"
    );
    await arrivalApi.cancel(row.id);
    await Promise.all([load(), searchOrders()]);
    emit("changed");
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  }
}
watch(warehouseId, () => {
  lines.value = [];
  tripId.value = undefined;
  void load(true);
  void searchOrders(true);
});
watch(visible, async open => {
  if (!open) {
    version++;
    searchVersion++;
    tripVersion++;
    return;
  }
  try {
    warehouses.value = (
      await warehouseApi.page({ status: 0, pageNum: 1, pageSize: 100 })
    ).records;
    if (!warehouseId.value && warehouses.value.length)
      warehouseId.value = warehouses.value[0].id;
    else {
      void load(true);
      void searchOrders(true);
    }
    void searchTrips();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "仓库加载失败");
  }
});
</script>
<template>
  <el-drawer
    v-model="visible"
    title="到货批次 · 一车多单 / 一单分批"
    size="1000px"
    :close-on-click-modal="false"
    :before-close="
      done => {
        if (!saving) done();
      }
    "
  >
    <el-select
      v-model="warehouseId"
      :disabled="saving"
      placeholder="先选收货仓库"
      ><el-option
        v-for="w in warehouses"
        :key="w.id"
        :value="w.id"
        :label="w.name"
    /></el-select>
    <h3>安排本次到货</h3>
    <p>可选多张入库单的部分数量。车次仅作运输关联；自送货物可以不选车次。</p>
    <el-form inline>
      <el-form-item label="关联车次"
        ><el-select
          v-model="tripId"
          filterable
          remote
          clearable
          :remote-method="searchTrips"
          placeholder="搜索车次号（可不选）"
          style="width: 260px"
          ><el-option
            v-for="t in tripOptions"
            :key="t.tripId"
            :value="t.tripId"
            :label="t.tripNo + ' / ' + (t.plateNumber || '')" /></el-select
      ></el-form-item>
      <el-form-item label="到货时间"
        ><el-date-picker
          v-model="arrivalTime"
          type="datetime"
          value-format="x"
          format="YYYY-MM-DD HH:mm:ss"
          @change="arrivalTime = Number(arrivalTime)"
      /></el-form-item>
    </el-form>
    <el-input
      v-model="search"
      placeholder="搜索入库单号"
      @keyup.enter="searchOrders(true)"
      ><template #append
        ><el-button @click="searchOrders(true)">查询入库单</el-button></template
      ></el-input
    >
    <div v-for="o in orders" :key="o.id">
      <h4>{{ o.inboundNo }} · {{ o.sourceNo || "手工入库" }}</h4>
      <el-table :data="o.items"
        ><el-table-column
          prop="sourceLineNo"
          label="来源行"
          width="90"
        /><el-table-column prop="skuName" label="商品" /><el-table-column
          prop="unassignedQuantity"
          label="未安排数量"
        />
        <el-table-column label="操作"
          ><template #default="{ row }"
            ><el-button
              link
              :disabled="
                loading ||
                row.unassignedQuantity <= 0 ||
                o.status === 3 ||
                o.status === 4
              "
              @click="add(o, row as InboundItem)"
              >加入本次到货</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </div>
    <el-pagination
      v-model:current-page="orderPage"
      :page-size="10"
      :total="orderTotal"
      layout="prev,pager,next"
      @current-change="searchOrders()"
    />
    <el-table :data="lines"
      ><el-table-column prop="label" label="本次到货来源" /><el-table-column
        label="本次数量"
        width="190"
        ><template #default="{ row }"
          ><el-input-number
            v-model="row.expectedQuantity"
            :min="1"
            :max="row.maximum"
            :precision="0" /></template></el-table-column
      ><el-table-column width="70"
        ><template #default="{ $index }"
          ><el-button link @click="lines.splice($index, 1)"
            >移除</el-button
          ></template
        ></el-table-column
      ></el-table
    >
    <el-button
      type="primary"
      :loading="saving"
      :disabled="!lines.length"
      @click="create"
      >创建到货批次</el-button
    >
    <h3>到货与收货进度</h3>
    <el-input
      v-model="tripNo"
      placeholder="按车次号查询，无车次留空"
      @keyup.enter="load(true)"
      ><template #append
        ><el-button @click="load(true)">查询到货</el-button></template
      ></el-input
    >
    <el-table v-loading="loading" :data="records"
      ><el-table-column type="expand"
        ><template #default="{ row }"
          ><el-table :data="row.items"
            ><el-table-column prop="inboundNo" label="入库单" /><el-table-column
              prop="sourceLineNo"
              label="来源行" /><el-table-column
              prop="skuName"
              label="商品" /><el-table-column
              prop="expectedQuantity"
              label="本批应收" /><el-table-column
              prop="receivedQuantity"
              label="本批实收" /></el-table></template
      ></el-table-column>
      <el-table-column prop="arrivalNo" label="到货编号" /><el-table-column
        prop="tripNo"
        label="车次"
      /><el-table-column label="到货时间" width="180"
        ><template #default="{ row }">{{
          formatDateTime(row.arrivalTime)
        }}</template></el-table-column
      ><el-table-column label="状态"
        ><template #default="{ row }">{{
          arrivalStatuses[row.status]
        }}</template></el-table-column
      ><el-table-column label="操作"
        ><template #default="{ row }"
          ><el-button
            v-if="row.status === 0"
            link
            type="danger"
            @click="cancel(row as Arrival)"
            >取消</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <el-pagination
      v-model:current-page="page"
      :page-size="10"
      :total="total"
      layout="total,prev,pager,next"
      @current-change="load()"
    />
  </el-drawer>
</template>
