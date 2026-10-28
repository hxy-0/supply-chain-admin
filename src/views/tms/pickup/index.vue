<script setup lang="ts">
import WorkspaceHeader from "@/components/Tms/WorkspaceHeader.vue";
import { onActivated, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { pickupExecutionApi } from "@/api/tmsPickupExecution";
import type { PickupTask } from "@/api/tmsPickup";
import { hasPerms } from "@/utils/auth";
import { pickupApi } from "@/api/tmsPickup";
defineOptions({ name: "TmsPickup" });
const task = ref<PickupTask>();
const busy = ref(false);
function cancellable(row: PickupTask) {
  return (
    ["PENDING", "ASSIGNED"].includes(row.status) &&
    row.items.every(item => Number(item.pickedQuantity) === 0)
  );
}

const router = useRouter();
const rows = ref<PickupTask[]>([]);
const taskNo = ref("");
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const labels: Record<string, string> = {
  PENDING: "待安排",
  ASSIGNED: "已安排",
  PARTIALLY_PICKED: "部分提货",
  FINISHED: "提货结束",
  CANCELLED: "已取消"
};
let loadVersion = 0;
function failure(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "操作失败");
}
async function load() {
  const version = ++loadVersion;
  loading.value = true;
  try {
    const result = await pickupExecutionApi.page({
      taskNo: taskNo.value,
      pageNum: page.value,
      pageSize: 20
    });
    if (version === loadVersion) {
      rows.value = result.records;
      total.value = result.total;
    }
  } catch (reason) {
    failure(reason);
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}
async function cancelTask(row: PickupTask) {
  task.value = row;
  if (!task.value) return;
  const taskId = task.value.pickupTaskId;
  try {
    await ElMessageBox.confirm(
      "取消提货任务会释放订单的数量占用，确认取消？",
      "取消提货任务"
    );
    busy.value = true;
    await pickupApi.cancel(taskId);
    await load();
  } catch (reason) {
    if (reason !== "cancel" && reason !== "close") failure(reason);
  } finally {
    busy.value = false;
  }
}
function show(id: string) {
  router.push({ name: "TmsPickupDetail", params: { id } });
}
onMounted(load);
onActivated(() => {
  if (!loading.value) load();
});
</script>
<template>
  <div class="tms-workspace">
    <WorkspaceHeader
      title="提货任务管理"
      description="跟进提货任务、实提商品与托盘来源；现场扫码和少备确认由司机在小程序完成。"
    />
    <section class="tms-panel">
      <div class="mb-4 flex gap-2">
        <el-input
          v-model="taskNo"
          placeholder="提货任务号"
          clearable
          style="width: 240px"
          @keyup.enter="
            page = 1;
            load();
          "
        /><el-button
          @click="
            page = 1;
            load();
          "
          >查询</el-button
        >
      </div>
      <el-table v-loading="loading" :data="rows"
        ><el-table-column prop="taskNo" label="任务号" min-width="210" />
        <el-table-column
          prop="tripNo"
          label="车次号"
          min-width="210"
        /><el-table-column prop="carrierName" label="承运人" /><el-table-column
          prop="pickupAddress"
          label="提货地址"
        /><el-table-column label="联系人" min-width="160">
          <template #default="{ row }">
            <div
              v-for="contact in row.contacts"
              :key="`${contact.name}:${contact.phone}`"
            >
              {{ contact.name }} {{ contact.phone }}
            </div>
          </template> </el-table-column
        ><el-table-column label="状态"
          ><template #default="{ row }">{{
            labels[row.status]
          }}</template></el-table-column
        ><el-table-column label="操作" min-width="210" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="show(row.pickupTaskId)"
              >详情</el-button
            >

            <el-button
              v-if="
                hasPerms('tms:pickup:cancel') && cancellable(row as PickupTask)
              "
              link
              type="danger"
              :disabled="busy"
              @click="cancelTask(row as PickupTask)"
              >取消</el-button
            >
          </template></el-table-column
        ></el-table
      >
      <el-pagination
        v-model:current-page="page"
        :page-size="20"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </section>
  </div>
</template>
