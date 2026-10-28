<script setup lang="ts">
import { onMounted, reactive, ref, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { outboundApi, outboundStatuses } from "@/api/wmsOutbound";
import type { OutboundOrder } from "@/api/wmsOutbound";
import { formatDateTime } from "@/utils/date";
import OutboundCreateDialog from "./OutboundCreateDialog.vue";
import OutboundDetailDrawer from "./OutboundDetailDrawer.vue";
const query = reactive({
  outboundNo: "",
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 20
});
const records = ref<OutboundOrder[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const creating = shallowRef(false);
const showing = shallowRef(false);
const selected = ref<OutboundOrder>();
let version = 0;
async function load(reset = false) {
  if (reset) query.pageNum = 1;
  const current = ++version;
  loading.value = true;
  try {
    const page = await outboundApi.page(query);
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
async function showDetail(order: OutboundOrder) {
  try {
    selected.value = await outboundApi.detail(order.id);
    showing.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "详情加载失败");
  }
}

async function allocate(order: OutboundOrder) {
  try {
    await outboundApi.allocate(order.id);
    ElMessage.success("分配成功，请在小程序按库位拣货");
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "分配失败");
  }
}
async function cancel(order: OutboundOrder) {
  try {
    await ElMessageBox.confirm(
      "取消未拣货出库单并释放库存占用？",
      "取消出库单",
      {
        type: "warning"
      }
    );
    await outboundApi.cancel(order.id);
    await load();
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  }
}
onMounted(() => load());
</script>

<template>
  <div class="outbound-page">
    <header>
      <div>
        <h2>出库管理</h2>
        <p>按单摘果、商品拣货、分板打包，全部打板后发运。</p>
      </div>
      <el-button type="primary" @click="creating = true">创建出库单</el-button>
    </header>
    <el-card shadow="never">
      <el-form inline @submit.prevent="load(true)">
        <el-form-item label="单号"
          ><el-input v-model="query.outboundNo" clearable maxlength="64"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select v-model="query.status" clearable style="width: 150px"
            ><el-option
              v-for="(label, index) in outboundStatuses"
              :key="index"
              :value="index"
              :label="label" /></el-select
        ></el-form-item>
        <el-button native-type="submit" type="primary">查询</el-button>
      </el-form>
      <el-table v-loading="loading" :data="records" row-key="id">
        <el-table-column prop="outboundNo" label="出库单号" /><el-table-column
          prop="warehouseName"
          label="仓库"
        />
        <el-table-column prop="destinationNodeName" label="收货节点" />
        <el-table-column label="状态"
          ><template #default="{ row }">{{
            outboundStatuses[row.status]
          }}</template></el-table-column
        >
        <el-table-column label="创建时间" width="180"
          ><template #default="{ row }">{{
            formatDateTime(row.createTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="240"
          ><template #default="{ row }">
            <el-button
              v-if="row.status === 0"
              link
              type="primary"
              @click="allocate(row as OutboundOrder)"
              >分配库存</el-button
            >
            <el-button
              link
              type="primary"
              @click="showDetail(row as OutboundOrder)"
              >详情</el-button
            >
            <el-button
              v-if="row.status === 0 || row.status === 1"
              link
              type="danger"
              @click="cancel(row as OutboundOrder)"
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
    <OutboundCreateDialog v-model="creating" @saved="load(true)" />
    <OutboundDetailDrawer v-model="showing" :order="selected" />
  </div>
</template>

<style scoped>
.outbound-page {
  padding: 24px;
}

.outbound-page header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.outbound-page h2 {
  margin: 0 0 8px;
}

.outbound-page p {
  color: #64748b;
}

.outbound-page .el-pagination {
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
