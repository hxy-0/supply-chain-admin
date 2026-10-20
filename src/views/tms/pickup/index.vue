<script setup lang="ts">
import WorkspaceHeader from "@/components/Tms/WorkspaceHeader.vue";
import { onActivated, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { pickupExecutionApi } from "@/api/tmsPickupExecution";
import type { PickupTask } from "@/api/tmsPickup";
import { hasPerms } from "@/utils/auth";
import { pickupApi } from "@/api/tmsPickup";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import { validQuantity, validMeasurement } from "../order/presentation";
import { createPalletCode } from "./presentation";
defineOptions({ name: "TmsPickup" });
const task = ref<PickupTask>();
const busy = ref(false);
const confirming = ref(false);
const finishing = ref(false);
const containerCode = ref("");
const containerType = ref("托盘");
const weight = ref("");
const volume = ref("");
const quantities = ref<Record<string, string>>({});
const reasons = ref<Record<string, string>>({});
function executable(row: PickupTask) {
  return ["PENDING", "ASSIGNED", "PARTIALLY_PICKED"].includes(row.status);
}
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
watch(containerType, type => {
  if ((type === "虚拟托盘") !== containerCode.value.startsWith("V")) {
    containerCode.value = createPalletCode(type);
  }
});
function prepareConfirm(row: PickupTask, type = "托盘") {
  task.value = row;
  containerCode.value = createPalletCode(type);
  containerType.value = type;
  weight.value = "";
  volume.value = "";
  quantities.value = {};
  confirming.value = true;
}
function prepareFinish(row: PickupTask) {
  task.value = row;
  reasons.value = {};
  finishing.value = true;
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
async function confirm() {
  if (!task.value) return;
  const taskId = task.value.pickupTaskId;
  const items = task.value.items
    .filter(item => quantities.value[item.taskItemId]?.trim())
    .map(item => ({
      taskItemId: item.taskItemId,
      quantity: quantities.value[item.taskItemId].trim()
    }));
  if (!containerCode.value.trim() || !containerType.value.trim())
    return ElMessage.warning("请填写装载单元编号与类型");
  if (!items.length || items.some(item => !validQuantity(item.quantity, true)))
    return ElMessage.warning("实提数量需为正数，商品数量必须为整数");
  if (
    [weight.value, volume.value].some(
      value => value !== "" && !validMeasurement(value)
    )
  )
    return ElMessage.warning("重量和体积需为非负数，最多四位小数");
  busy.value = true;
  try {
    const selected = task.value.items.filter(row =>
      items.some(item => item.taskItemId === row.taskItemId)
    );
    const unloadIds = [
      ...new Set(selected.map(item => item.unloadStopId).filter(Boolean))
    ];
    if (containerType.value === "虚拟托盘" && unloadIds.length !== 1)
      throw new Error("一个虚拟托盘只能对应一个卸货点，请分别登记");
    const result =
      containerType.value === "虚拟托盘"
        ? await pickupExecutionApi.confirmVirtual(taskId, {
            unloadStopId: unloadIds[0]!,
            items
          })
        : await pickupExecutionApi.confirm(taskId, {
            containerCode: containerCode.value.trim(),
            containerType: containerType.value.trim(),
            weightKg: weight.value || undefined,
            volumeCm3: volume.value || undefined,
            items
          });
    confirming.value = false;
    ElMessage.success(
      `${result.containerType} ${result.containerCode} 实提已确认`
    );
    await load();
  } catch (reason) {
    failure(reason);
  } finally {
    busy.value = false;
  }
}
async function finish() {
  if (!task.value) return;
  const taskId = task.value.pickupTaskId;
  if (
    task.value.items.some(
      item =>
        Number(item.remainingQuantity) > 0 &&
        !reasons.value[item.taskItemId]?.trim()
    )
  )
    return ElMessage.warning("每个未足量提货明细都需填写少备原因");
  try {
    await ElMessageBox.confirm(
      "结束后不能继续给本任务确认实提；未提余量将释放，可新建补提任务。确认结束？",
      "提货结束"
    );
  } catch {
    return;
  }
  busy.value = true;
  try {
    await pickupExecutionApi.finish(taskId, {
      items: task.value.items.map(item => ({
        taskItemId: item.taskItemId,
        shortageReason: reasons.value[item.taskItemId]?.trim() || undefined
      }))
    });
    finishing.value = false;
    ElMessage.success("提货已结束，剩余预留已释放");
    await load();
  } catch (reason) {
    failure(reason);
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
      title="提货与容器作业"
      description="核对任务、确认实提，将每一件货物落实到容器。"
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
            <el-dropdown
              v-if="
                executable(row as PickupTask) &&
                (hasPerms('tms:pickup:confirm') ||
                  hasPerms('tms:pickup:finish'))
              "
              class="mx-3"
              :disabled="busy"
              trigger="click"
            >
              <el-button link type="primary" :disabled="busy">作业</el-button>
              <template #dropdown
                ><el-dropdown-menu>
                  <el-dropdown-item
                    v-if="hasPerms('tms:pickup:confirm')"
                    @click="prepareConfirm(row as PickupTask, '托盘')"
                    >登记托盘实提</el-dropdown-item
                  >
                  <el-dropdown-item
                    v-if="hasPerms('tms:pickup:confirm')"
                    @click="prepareConfirm(row as PickupTask, '虚拟托盘')"
                    >登记虚拟托盘实提</el-dropdown-item
                  >
                  <el-dropdown-item
                    v-if="hasPerms('tms:pickup:finish')"
                    @click="prepareFinish(row as PickupTask)"
                    >提货结束 / 少备确认</el-dropdown-item
                  >
                </el-dropdown-menu></template
              >
            </el-dropdown>
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
    <BusinessDialog
      v-model="confirming"
      :title="
        containerType === '虚拟托盘'
          ? '登记虚拟托盘实提'
          : '登记托盘 / 容器实提'
      "
      width="1000px"
      :busy="busy"
      submit-text="确认实提"
      @submit="confirm"
    >
      <el-alert
        title="托盘或虚拟托盘可包含多个订单的商品，但最终目的地必须相同。未提商品留空。"
        type="info"
        :closable="false"
      />
      <el-form label-width="100px" :disabled="busy"
        ><el-form-item
          :label="containerType === '虚拟托盘' ? '虚拟托盘号' : '托盘 / 容器号'"
          ><el-input v-model="containerCode" :maxlength="64" /></el-form-item
        ><el-form-item label="装载方式"
          ><el-select v-model="containerType"
            ><el-option
              v-for="type in ['托盘', '虚拟托盘', '笼车', '箱架']"
              :key="type"
              :label="type"
              :value="type" /></el-select></el-form-item
        ><el-form-item label="重量 kg"
          ><el-input v-model="weight" placeholder="未知" /></el-form-item
        ><el-form-item label="体积 cm³"
          ><el-input v-model="volume" placeholder="未知" /></el-form-item
      ></el-form>
      <el-table :data="task?.items"
        ><el-table-column
          prop="orderNo"
          label="来源订单"
          min-width="200" /><el-table-column
          prop="goodsName"
          label="货物" /><el-table-column
          prop="unit"
          label="单位" /><el-table-column
          prop="remainingQuantity"
          label="可实提量" /><el-table-column label="本次实提量"
          ><template #default="{ row }"
            ><el-input
              v-model="quantities[row.taskItemId]"
              :disabled="busy || Number(row.remainingQuantity) === 0"
              placeholder="未装入留空" /></template></el-table-column
      ></el-table>
    </BusinessDialog>
    <BusinessDialog
      v-model="finishing"
      title="提货结束及少备确认"
      width="1000px"
      :busy="busy"
      submit-text="结束提货"
      @submit="finish"
    >
      <p>
        少备按每个任务行的计划量减实提量计算；它不会直接成为订单的最终差额。全部少备且实提为零时，将取消本任务未执行车次。
      </p>
      <el-table :data="task?.items"
        ><el-table-column
          prop="orderNo"
          label="来源订单"
          min-width="200"
        /><el-table-column prop="goodsName" label="货物" /><el-table-column
          prop="unit"
          label="单位"
        /><el-table-column
          prop="plannedQuantity"
          label="计划量"
        /><el-table-column
          prop="pickedQuantity"
          label="实提量"
        /><el-table-column
          prop="remainingQuantity"
          label="本次少备量"
        /><el-table-column label="少备原因" min-width="250"
          ><template #default="{ row }"
            ><el-input
              v-if="Number(row.remainingQuantity) > 0"
              v-model="reasons[row.taskItemId]"
              :disabled="busy"
              :maxlength="500"
              placeholder="例如供应商少备"
            /><span v-else>足量提货</span></template
          ></el-table-column
        ></el-table
      >
    </BusinessDialog>
  </div>
</template>
