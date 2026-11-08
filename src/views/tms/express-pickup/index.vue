<script setup lang="ts">
import { reactive, ref, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  pickupApi,
  pickupStatuses,
  type PickupServiceOrder
} from "@/api/tmsExpress";
import { orderApi, type TmsOrder } from "@/api/tmsOrder";
import { formatDateTime } from "@/utils/date";

defineOptions({ name: "ExpressPickup" });

const query = reactive({
  serviceNo: "",
  status: undefined as number | undefined,
  pageNum: 1,
  pageSize: 20
});
const records = ref<PickupServiceOrder[]>([]);
const total = shallowRef(0);
const loading = shallowRef(false);
const acting = shallowRef("");
const detailVisible = shallowRef(false);
const detailLoading = shallowRef(false);
const detail = ref<PickupServiceOrder>();
const createVisible = shallowRef(false);
const createForm = reactive({
  orderId: "",
  appointStartTime: "",
  appointEndTime: "",
  remark: ""
});
const orderOptions = ref<TmsOrder[]>([]);
const acceptVisible = shallowRef(false);
const acceptTarget = ref<PickupServiceOrder>();
const acceptForm = reactive({ courierName: "", courierPhone: "" });
const completeVisible = shallowRef(false);
const completeTarget = ref<PickupServiceOrder>();
const completeForm = reactive({
  actualWeightKg: undefined as number | undefined,
  actualVolumeCm3: undefined as number | undefined,
  actualPieceCount: undefined as number | undefined
});
const pickupStatusTag: Record<
  number,
  "warning" | "primary" | "success" | "info"
> = {
  10: "warning",
  20: "primary",
  30: "success",
  99: "info"
};
let requestVersion = 0;

async function load(reset = false) {
  if (reset) query.pageNum = 1;
  const current = ++requestVersion;
  loading.value = true;
  try {
    const page = await pickupApi.page({ ...query });
    if (current === requestVersion) {
      records.value = page.records;
      total.value = Number(page.total);
    }
  } catch (error) {
    if (current === requestVersion)
      ElMessage.error(
        error instanceof Error ? error.message : "服务单加载失败"
      );
  } finally {
    if (current === requestVersion) loading.value = false;
  }
}
async function searchOrders(orderNo = "") {
  try {
    orderOptions.value = (
      await orderApi.page({ orderNo, pageNum: 1, pageSize: 20 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "订单加载失败");
  }
}
async function openDetail(row: PickupServiceOrder, reload = false) {
  detailVisible.value = true;
  if (!reload) detailLoading.value = true;
  try {
    detail.value = await pickupApi.detail(row.serviceOrderId);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "详情加载失败");
  } finally {
    detailLoading.value = false;
  }
}
function create() {
  createForm.orderId = "";
  createForm.appointStartTime = "";
  createForm.appointEndTime = "";
  createForm.remark = "";
  orderOptions.value = [];
  createVisible.value = true;
  void searchOrders();
}
async function saveCreate() {
  if (!createForm.orderId) {
    ElMessage.error("请选择揽收订单");
    return;
  }
  try {
    await pickupApi.create({
      orderId: createForm.orderId,
      appointStartTime: createForm.appointStartTime
        ? Number(createForm.appointStartTime)
        : undefined,
      appointEndTime: createForm.appointEndTime
        ? Number(createForm.appointEndTime)
        : undefined,
      remark: createForm.remark.trim() || undefined
    });
    createVisible.value = false;
    ElMessage.success("揽收服务单已创建");
    await load(true);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "创建失败");
  }
}
function accept(row: PickupServiceOrder) {
  acceptTarget.value = row;
  acceptForm.courierName = "";
  acceptForm.courierPhone = "";
  acceptVisible.value = true;
}
async function saveAccept() {
  const target = acceptTarget.value;
  if (!target) return;
  if (!acceptForm.courierName.trim()) {
    ElMessage.error("请填写快递员姓名");
    return;
  }
  try {
    await pickupApi.accept({
      serviceOrderId: target.serviceOrderId,
      courierName: acceptForm.courierName.trim(),
      courierPhone: acceptForm.courierPhone.trim() || undefined
    });
    acceptVisible.value = false;
    ElMessage.success("服务单已受理");
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "受理失败");
  }
}
function complete(row: PickupServiceOrder) {
  completeTarget.value = row;
  completeForm.actualWeightKg = undefined;
  completeForm.actualVolumeCm3 = undefined;
  completeForm.actualPieceCount = undefined;
  completeVisible.value = true;
}
async function saveComplete() {
  const target = completeTarget.value;
  if (!target) return;
  try {
    await pickupApi.complete({
      serviceOrderId: target.serviceOrderId,
      actualWeightKg: completeForm.actualWeightKg,
      actualVolumeCm3: completeForm.actualVolumeCm3,
      actualPieceCount: completeForm.actualPieceCount,
      actualPickupTime: Date.now()
    });
    completeVisible.value = false;
    ElMessage.success("服务单已完成");
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "完成失败");
  }
}
async function cancel(row: PickupServiceOrder) {
  try {
    await ElMessageBox.confirm(
      `取消揽收服务单「${row.serviceNo}」？`,
      "取消服务单",
      { type: "warning" }
    );
    acting.value = row.serviceOrderId;
    await pickupApi.cancel(row.serviceOrderId);
    ElMessage.success("服务单已取消");
    await load();
  } catch (error) {
    if (error instanceof Error) ElMessage.error(error.message);
  } finally {
    acting.value = "";
  }
}
function reset() {
  query.serviceNo = "";
  query.status = undefined;
  void load(true);
}
load(true);
</script>

<template>
  <div class="main">
    <el-card shadow="never">
      <template #header
        ><div class="header">
          <span>揽收服务单</span
          ><el-button type="primary" @click="create">新建服务单</el-button>
        </div></template
      >
      <el-form inline @submit.prevent="load(true)">
        <el-form-item label="服务单号"
          ><el-input v-model="query.serviceNo" clearable maxlength="64"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select v-model="query.status" clearable style="width: 140px"
            ><el-option
              v-for="(label, value) in pickupStatuses"
              :key="value"
              :value="Number(value)"
              :label="label" /></el-select
        ></el-form-item>
        <el-button native-type="submit" type="primary">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </el-form>
      <el-table v-loading="loading" :data="records" row-key="serviceOrderId">
        <el-table-column label="服务单号" min-width="180"
          ><template #default="{ row }"
            ><span class="service-no">{{
              (row as PickupServiceOrder).serviceNo
            }}</span
            ><br /><el-tag
              :type="pickupStatusTag[(row as PickupServiceOrder).status]"
              size="small"
              >{{
                pickupStatuses[(row as PickupServiceOrder).status] ??
                (row as PickupServiceOrder).status
              }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column prop="orderNo" label="运输订单" min-width="180" />
        <el-table-column label="快递员" min-width="130"
          ><template #default="{ row }"
            >{{ (row as PickupServiceOrder).courierName || "-" }}
            {{ (row as PickupServiceOrder).courierPhone || "" }}</template
          ></el-table-column
        >
        <el-table-column label="预约时间" min-width="200"
          ><template #default="{ row }">
            <p class="time-line">
              {{ formatDateTime((row as PickupServiceOrder).appointStartTime) }}
            </p>
            <p class="time-line">
              ~ {{ formatDateTime((row as PickupServiceOrder).appointEndTime) }}
            </p>
          </template></el-table-column
        >
        <el-table-column label="完成时间" width="170"
          ><template #default="{ row }">{{
            formatDateTime((row as PickupServiceOrder).completeTime)
          }}</template></el-table-column
        >
        <el-table-column label="实提" width="130"
          ><template #default="{ row }"
            >{{ (row as PickupServiceOrder).actualPieceCount ?? "-" }} 件 /
            {{ (row as PickupServiceOrder).actualWeightKg ?? "-" }} kg</template
          ></el-table-column
        >
        <el-table-column label="操作" width="220" fixed="right"
          ><template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="openDetail(row as PickupServiceOrder)"
              >详情</el-button
            >
            <el-button
              v-if="(row as PickupServiceOrder).status === 10"
              link
              type="primary"
              @click="accept(row as PickupServiceOrder)"
              >受理</el-button
            >
            <el-button
              v-if="(row as PickupServiceOrder).status === 20"
              link
              type="primary"
              @click="complete(row as PickupServiceOrder)"
              >完成</el-button
            >
            <el-button
              v-if="
                (row as PickupServiceOrder).status === 10 ||
                (row as PickupServiceOrder).status === 20
              "
              link
              type="danger"
              :disabled="Boolean(acting)"
              @click="cancel(row as PickupServiceOrder)"
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
    <el-dialog
      v-model="createVisible"
      title="新建揽收服务单"
      width="560px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-width="100px" @submit.prevent="saveCreate">
        <el-form-item label="运输订单" required
          ><el-select
            v-model="createForm.orderId"
            filterable
            remote
            :remote-method="searchOrders"
            placeholder="按订单号搜索"
            style="width: 100%"
            ><el-option
              v-for="order in orderOptions"
              :key="order.orderId"
              :value="order.orderId"
              :label="
                order.orderNo +
                (order.pickupAddress ? ' · ' + order.pickupAddress : '')
              " /></el-select
        ></el-form-item>
        <el-form-item label="预约开始"
          ><el-date-picker
            v-model="createForm.appointStartTime"
            type="datetime"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="x"
        /></el-form-item>
        <el-form-item label="预约结束"
          ><el-date-picker
            v-model="createForm.appointEndTime"
            type="datetime"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="x"
        /></el-form-item>
        <el-form-item label="备注"
          ><el-input v-model="createForm.remark" maxlength="255"
        /></el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit">保存</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
    <el-dialog
      v-model="acceptVisible"
      title="受理服务单"
      width="480px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-width="100px" @submit.prevent="saveAccept">
        <el-form-item label="快递员" required
          ><el-input v-model="acceptForm.courierName" maxlength="64"
        /></el-form-item>
        <el-form-item label="联系电话"
          ><el-input v-model="acceptForm.courierPhone" maxlength="32"
        /></el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit">受理</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
    <el-dialog
      v-model="completeVisible"
      title="完成揽收"
      width="480px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form label-width="110px" @submit.prevent="saveComplete">
        <el-form-item label="实提件数"
          ><el-input-number
            v-model="completeForm.actualPieceCount"
            :min="0"
            :precision="0"
            aria-label="实提件数"
        /></el-form-item>
        <el-form-item label="实提重量(kg)"
          ><el-input-number
            v-model="completeForm.actualWeightKg"
            :min="0"
            :precision="2"
            aria-label="实提重量"
        /></el-form-item>
        <el-form-item label="体积(cm³)"
          ><el-input-number
            v-model="completeForm.actualVolumeCm3"
            :min="0"
            :precision="0"
            aria-label="实提体积"
        /></el-form-item>
        <el-form-item>
          <el-button type="primary" native-type="submit">完成</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
    <el-drawer
      v-model="detailVisible"
      title="服务单详情"
      size="min(620px, 95vw)"
    >
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="服务单号">{{
              detail.serviceNo
            }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{
              pickupStatuses[detail.status] ?? detail.status
            }}</el-descriptions-item>
            <el-descriptions-item label="运输订单">{{
              detail.orderNo
            }}</el-descriptions-item>
            <el-descriptions-item label="快递员"
              >{{ detail.courierName || "-" }}
              {{ detail.courierPhone || "" }}</el-descriptions-item
            >
            <el-descriptions-item label="预约开始">{{
              formatDateTime(detail.appointStartTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="预约结束">{{
              formatDateTime(detail.appointEndTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="完成时间">{{
              formatDateTime(detail.completeTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="实提"
              >{{ detail.actualPieceCount ?? "-" }} 件 /
              {{ detail.actualWeightKg ?? "-" }} kg</el-descriptions-item
            >
            <el-descriptions-item label="取消原因">{{
              detail.cancelReason || "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{
              detail.remark || "-"
            }}</el-descriptions-item>
          </el-descriptions>
          <div class="detail-actions">
            <el-button @click="openDetail(detail, true)">刷新</el-button>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.service-no {
  font-weight: 600;
}

.time-line {
  margin: 0;
  line-height: 1.6;
}

.detail-actions {
  margin-top: 16px;
}
</style>
