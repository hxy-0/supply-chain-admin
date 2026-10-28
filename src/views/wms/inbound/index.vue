<script setup lang="ts">
import { onMounted, reactive, ref, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { inboundApi, inboundStatuses } from "@/api/wmsInbound";
import type { InboundOrder } from "@/api/wmsInbound";
import { formatDateTime } from "@/utils/date";
import InboundArrivalDrawer from "./InboundArrivalDrawer.vue";
import InboundCreateDialog from "./InboundCreateDialog.vue";
import InboundDetailDrawer from "./InboundDetailDrawer.vue";
const query = reactive({
  inboundNo: "",
  sourceNo: "",
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 20
});
const records = ref<InboundOrder[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const creating = shallowRef(false);
const arrivalsOpen = shallowRef(false);
const showing = shallowRef(false);
const selected = ref<InboundOrder>();
let version = 0;
async function load(reset = false) {
  if (reset) query.pageNum = 1;
  const current = ++version;
  loading.value = true;
  try {
    const page = await inboundApi.page(query);
    if (current === version) {
      records.value = page.records;
      total.value = Number(page.total);
    }
  } catch (error) {
    if (current === version)
      ElMessage.error(error instanceof Error ? error.message : "加载失败");
  } finally {
    if (current === version) loading.value = false;
  }
}
async function showDetail(order: InboundOrder) {
  try {
    selected.value = await inboundApi.detail(order.id);
    showing.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "详情加载失败");
  }
}

async function cancel(order: InboundOrder) {
  try {
    await ElMessageBox.confirm("取消尚未收货的入库单？", "取消入库单", {
      type: "warning"
    });
    await inboundApi.cancel(order.id);
    await load();
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  }
}
onMounted(() => load());
</script>

<template>
  <div class="inbound-page">
    <header>
      <div>
        <h2>入库管理</h2>
        <p>管理端建单，小程序按卡板收货、拆板按商品分库位上架。</p>
      </div>
      <div>
        <el-button @click="arrivalsOpen = true">到货批次 / 车次收货</el-button
        ><el-button type="primary" @click="creating = true"
          >创建入库单</el-button
        >
      </div>
    </header>
    <el-card shadow="never">
      <el-form inline @submit.prevent="load(true)">
        <el-form-item label="单号"
          ><el-input v-model="query.inboundNo" clearable maxlength="64"
        /></el-form-item>
        <el-form-item label="来源单号"
          ><el-input v-model="query.sourceNo" clearable maxlength="64"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select v-model="query.status" clearable style="width: 150px"
            ><el-option
              v-for="(label, index) in inboundStatuses"
              :key="index"
              :value="index"
              :label="label" /></el-select
        ></el-form-item>
        <el-button native-type="submit" type="primary">查询</el-button>
      </el-form>
      <el-table v-loading="loading" :data="records" row-key="id">
        <el-table-column prop="inboundNo" label="入库单号" /><el-table-column
          prop="warehouseName"
          label="仓库"
        />
        <el-table-column prop="sourceNo" label="来源单据" /><el-table-column
          prop="deliveryBatchNo"
          label="交付批次"
        /><el-table-column prop="supplierName" label="供应商" />
        <el-table-column label="状态"
          ><template #default="{ row }">{{
            inboundStatuses[row.status]
          }}</template></el-table-column
        >
        <el-table-column label="创建时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.createTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="150"
          ><template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="showDetail(row as InboundOrder)"
              >详情</el-button
            >
            <el-button
              v-if="row.status === 0"
              link
              type="danger"
              @click="cancel(row as InboundOrder)"
              >取消</el-button
            >
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
    <InboundArrivalDrawer v-model="arrivalsOpen" @changed="load()" />
    <InboundCreateDialog v-model="creating" @saved="load(true)" />
    <InboundDetailDrawer v-model="showing" :order="selected" />
  </div>
</template>

<style scoped>
.inbound-page {
  padding: 24px;
}

.inbound-page header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.inbound-page h2 {
  margin: 0 0 8px;
}

.inbound-page p {
  color: #64748b;
}

.inbound-page .el-pagination {
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
