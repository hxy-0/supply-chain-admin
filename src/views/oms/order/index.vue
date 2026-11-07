<script setup lang="ts">
import { computed, ref, reactive, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  omsApi,
  orderStatuses,
  type OmsOrder,
  type OrderStatus
} from "@/api/oms";
import { formatDateTime } from "@/utils/date";
import OrderEditDrawer from "./OrderEditDrawer.vue";
import OrderDetailDrawer from "./OrderDetailDrawer.vue";

const route = useRoute();
const orderType = computed(() =>
  route.path === "/oms/transfers" ? "TRANSFER" : "PURCHASE"
);
const title = computed(() =>
  orderType.value === "PURCHASE" ? "采购订单" : "调拨单"
);
const query = reactive({
  orderNo: "",
  status: undefined as OrderStatus | undefined,
  pageNum: 1,
  pageSize: 20
});
const records = ref<OmsOrder[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const acting = shallowRef("");
const editing = shallowRef(false);
const showing = shallowRef(false);
const selected = ref<OmsOrder>();
let requestVersion = 0;
async function load(reset = false) {
  if (reset) query.pageNum = 1;
  const current = ++requestVersion;
  loading.value = true;
  try {
    const page = await omsApi.page({ ...query, orderType: orderType.value });
    if (current === requestVersion) {
      records.value = page.records;
      total.value = Number(page.total);
    }
  } catch (error) {
    if (current === requestVersion)
      ElMessage.error(error instanceof Error ? error.message : "订单加载失败");
  } finally {
    if (current === requestVersion) loading.value = false;
  }
}
async function open(order: OmsOrder, edit = false) {
  try {
    selected.value = await omsApi.detail(order.orderId);
    if (edit) editing.value = true;
    else showing.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "详情加载失败");
  }
}
function create() {
  selected.value = undefined;
  editing.value = true;
}
async function release(order: OmsOrder) {
  try {
    await ElMessageBox.confirm(
      orderType.value === "PURCHASE"
        ? "释放后将安排提货运输，需求不可再修改。"
        : "释放后将向源仓下发出库需求，需求不可再修改。",
      "释放订单",
      { type: "warning" }
    );
    acting.value = order.orderId;
    await omsApi.release(order);
    ElMessage.success("订单已释放，执行单据由后台生成");
    await load();
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  } finally {
    acting.value = "";
  }
}
async function cancel(order: OmsOrder) {
  try {
    const result = await ElMessageBox.prompt("请输入取消原因", "取消草稿", {
      inputValidator: value => Boolean(value?.trim()) || "请填写取消原因",
      inputType: "textarea"
    });
    acting.value = order.orderId;
    await omsApi.cancel(order, result.value.trim());
    await load();
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  } finally {
    acting.value = "";
  }
}
watch(
  orderType,
  () => {
    editing.value = false;
    showing.value = false;
    selected.value = undefined;
    query.orderNo = "";
    query.status = undefined;
    void load(true);
  },
  { immediate: true }
);
</script>

<template>
  <div class="main">
    <el-card shadow="never">
      <template #header
        ><div class="header">
          <span>{{ title }}</span
          ><el-button type="primary" @click="create">新建{{ title }}</el-button>
        </div></template
      >
      <el-form inline @submit.prevent="load(true)">
        <el-form-item label="单号"
          ><el-input v-model="query.orderNo" clearable maxlength="64"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select v-model="query.status" clearable style="width: 140px"
            ><el-option
              v-for="(label, value) in orderStatuses"
              :key="value"
              :value="value"
              :label="label" /></el-select
        ></el-form-item>
        <el-button native-type="submit" type="primary">查询</el-button>
      </el-form>
      <el-table v-loading="loading" :data="records" row-key="orderId">
        <el-table-column prop="orderNo" label="订单号" min-width="210" />
        <el-table-column
          v-if="orderType === 'PURCHASE'"
          prop="supplierName"
          label="供应商"
          min-width="130"
        />
        <el-table-column
          v-else
          prop="sourceWarehouseName"
          label="源仓"
          min-width="130"
        />
        <el-table-column
          prop="targetWarehouseName"
          label="目标仓"
          min-width="130"
        />
        <el-table-column label="状态" width="100"
          ><template #default="{ row }">{{
            orderStatuses[row.status as OrderStatus]
          }}</template></el-table-column
        >
        <el-table-column label="计划到货" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.expectDeliveryTime)
          }}</template></el-table-column
        >
        <el-table-column label="创建时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.createTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="250" fixed="right"
          ><template #default="{ row }">
            <el-button link type="primary" @click="open(row as OmsOrder)"
              >详情</el-button
            >
            <template v-if="row.status === 'DRAFT'">
              <el-button
                link
                type="primary"
                @click="open(row as OmsOrder, true)"
                >编辑</el-button
              >
              <el-button
                link
                type="primary"
                :disabled="Boolean(acting)"
                @click="release(row as OmsOrder)"
                >释放</el-button
              >
              <el-button
                link
                type="danger"
                :disabled="Boolean(acting)"
                @click="cancel(row as OmsOrder)"
                >取消</el-button
              >
            </template>
          </template></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="query.pageNum"
        :page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load()"
      />
    </el-card>
    <OrderEditDrawer
      v-model="editing"
      :order-type="orderType"
      :order="selected"
      @saved="load(true)"
    />
    <OrderDetailDrawer
      v-model="showing"
      :order="selected"
      @refresh="selected && open(selected)"
    />
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
