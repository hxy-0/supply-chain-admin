<script setup lang="ts">
import { ref, watch, toRaw } from "vue";
import { ElMessage, type FormInstance } from "element-plus";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import OrderPickupPlanForm from "./OrderPickupPlanForm.vue";
import OrderTransport from "./OrderTransport.vue";
import { formatDateTime } from "@/utils/date";
import {
  orderApi,
  type TmsOrder,
  type OrderCommand,
  type OrderItem
} from "@/api/tmsOrder";
import { logisticNodeApi, type LogisticNode, type PageResult } from "@/api/tms";
import { pmsRequest, type Sku } from "@/api/pms";
import { statusLabels, validQuantity, validMeasurement } from "../presentation";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{ order?: TmsOrder; readonly: boolean }>();
const emit = defineEmits<{ saved: [] }>();
const formRef = ref<FormInstance>();
const busy = ref(false);
const nodes = ref<LogisticNode[]>([]);
const skus = ref<Sku[]>([]);
const form = ref<OrderCommand>(emptyForm());
const deliveryTime = ref<number>();
let queryVersion = 0;

function emptyForm(): OrderCommand {
  return {
    pickupNodeId: "",
    senderName: "",
    senderPhone: "",
    destinationNodeId: "",
    receiverName: "",
    receiverPhone: "",
    items: []
  };
}
function error(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "操作失败");
}
async function searchNodes(name = "") {
  try {
    const page = await logisticNodeApi.page({ name, pageNum: 1, pageSize: 50 });
    nodes.value = [
      ...new Map(
        [...nodes.value, ...page.records].map(node => [node.id, node])
      ).values()
    ];
  } catch (reason) {
    error(reason);
  }
}
async function searchSkus(skuCode = "") {
  try {
    const page = await pmsRequest<PageResult<{ sku: Sku }>>(
      "get",
      "/skus",
      undefined,
      { skuCode, isEnable: 1, pageNum: 1, pageSize: 50 }
    );
    skus.value = [
      ...new Map(
        [...skus.value, ...page.records.map(row => row.sku)].map(sku => [
          String(sku.skuId),
          sku
        ])
      ).values()
    ];
  } catch (reason) {
    error(reason);
  }
}
function selectSku(item: OrderItem) {
  const sku = skus.value.find(sku => String(sku.skuId) === String(item.skuId));
  if (sku) {
    item.goodsName = sku.name || "";
    item.skuCode = sku.skuCode;
    item.specText = sku.specText;
  }
}
function changeSource(item: OrderItem) {
  item.skuId = undefined;
  item.skuCode = undefined;
  item.goodsName = "";
  item.specText = undefined;
  item.weightKg = undefined;
  item.volumeCm3 = undefined;
}
function addItem() {
  form.value.items.push({
    goodsSource: "MANUAL",
    goodsName: "",
    unit: "",
    orderedQuantity: "1"
  });
}
watch(
  open,
  async value => {
    if (!value) {
      ++queryVersion;
      return;
    }
    const version = ++queryVersion;
    form.value = props.order
      ? structuredClone(toRaw(props.order))
      : emptyForm();
    deliveryTime.value =
      form.value.expectDeliveryTime == null
        ? undefined
        : Number(form.value.expectDeliveryTime);
    if (!props.readonly) {
      await Promise.all([searchNodes(), searchSkus()]);
      if (version !== queryVersion) return;
      if (
        props.order &&
        !nodes.value.some(node => node.id === props.order?.destinationNodeId)
      ) {
        try {
          const node = await logisticNodeApi.get(props.order.destinationNodeId);
          if (version === queryVersion) nodes.value.push(node);
        } catch (reason) {
          error(reason);
        }
      }
    }
  },
  { immediate: true }
);
const rules = {
  pickupNodeId: [
    { required: true, message: "请选择提货点", trigger: "change" }
  ],
  senderName: [{ required: true, message: "请填写发货人", trigger: "blur" }],
  senderPhone: [{ required: true, message: "请填写发货电话", trigger: "blur" }],
  plannedPackageCount: [
    {
      required: true,
      type: "number" as const,
      min: 1,
      message: "计划包裹数必须为正整数",
      trigger: "change"
    }
  ],
  expectPickupTime: [
    {
      required: true,
      type: "number" as const,
      message: "请选择计划提货时间",
      trigger: "change"
    }
  ],
  destinationNodeId: [
    { required: true, message: "请选择最终目的地", trigger: "change" }
  ],
  receiverName: [{ required: true, message: "请填写收货人", trigger: "blur" }],
  receiverPhone: [
    { required: true, message: "请填写收货电话", trigger: "blur" }
  ]
};

async function save() {
  if (busy.value || props.readonly) return;
  if (!(await formRef.value?.validate().catch(() => false))) return;
  if (!form.value.items.length)
    return ElMessage.warning("请至少添加一条商品明细");
  for (const item of form.value.items) {
    if (!item.unit.trim() || !validQuantity(item.orderedQuantity, true))
      return ElMessage.warning("每行须填写单位和正数数量，商品数量必须为整数");
    if (item.goodsSource === "SKU" ? !item.skuId : !item.goodsName.trim())
      return ElMessage.warning("请选择 SKU 或填写手工商品名称");
    for (const quantity of [item.weightKg, item.volumeCm3]) {
      if (quantity != null && quantity !== "" && !validMeasurement(quantity))
        return ElMessage.warning("参考重量和体积须为非负数，最多四位小数");
    }
  }
  if (
    !form.value.pickupNodeId ||
    !form.value.senderName?.trim() ||
    !form.value.senderPhone?.trim() ||
    !form.value.plannedPackageCount ||
    form.value.expectPickupTime == null
  )
    return ElMessage.warning("请补全提货点、联系人、计划包裹数和提货时间");
  const command: OrderCommand = {
    pickupNodeId: form.value.pickupNodeId,
    senderName: form.value.senderName,
    senderPhone: form.value.senderPhone,
    plannedPackageCount: form.value.plannedPackageCount,
    destinationNodeId: form.value.destinationNodeId,
    receiverName: form.value.receiverName,
    receiverPhone: form.value.receiverPhone,
    remark: form.value.remark,
    version: form.value.version,
    expectPickupTime: form.value.expectPickupTime,
    expectDeliveryTime: deliveryTime.value
      ? Number(deliveryTime.value)
      : undefined,
    items: form.value.items.map(item => ({
      orderItemId: item.orderItemId,
      goodsSource: item.goodsSource,
      skuId: item.skuId,
      goodsName: item.goodsName,
      specText: item.specText,
      unit: item.unit.trim(),
      orderedQuantity: item.orderedQuantity,
      weightKg: item.weightKg === "" ? undefined : item.weightKg,
      volumeCm3: item.volumeCm3 === "" ? undefined : item.volumeCm3
    }))
  };
  busy.value = true;
  try {
    if (props.order) await orderApi.update(props.order.orderId, command);
    else await orderApi.create(command);
    ElMessage.success(props.order ? "订单已更新" : "订单已创建");
    open.value = false;
    emit("saved");
  } catch (reason) {
    error(reason);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BusinessDialog
    v-model="open"
    :title="readonly ? '订单详情' : order ? '修改运输需求' : '创建运输需求'"
    width="1120px"
    :busy="busy"
    :readonly="readonly"
    @submit="save"
  >
    <el-descriptions v-if="order" :column="3" border class="mb-4">
      <el-descriptions-item label="订单号">{{
        order.orderNo
      }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{
        statusLabels[order.status]
      }}</el-descriptions-item>
      <el-descriptions-item label="创建时间">{{
        formatDateTime(order.createTime)
      }}</el-descriptions-item>
      <el-descriptions-item v-if="order.closedTime" label="完结时间">{{
        formatDateTime(order.closedTime)
      }}</el-descriptions-item>
      <el-descriptions-item v-if="order.cancelReason" label="取消原因">{{
        order.cancelReason
      }}</el-descriptions-item>
    </el-descriptions>
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="110px"
      :disabled="readonly || busy"
    >
      <h4 class="mb-3">提货计划</h4>
      <OrderPickupPlanForm
        v-model="form"
        :readonly="readonly"
        :node-name="order?.pickupNodeName"
      />
      <h4 class="mb-3">收货信息</h4>
      <el-row :gutter="16">
        <el-col :span="12"
          ><el-form-item label="最终目的地" prop="destinationNodeId">
            <span v-if="readonly">{{
              order?.destinationNodeName || form.destinationNodeId
            }}</span>
            <el-select
              v-else
              v-model="form.destinationNodeId"
              filterable
              remote
              :remote-method="searchNodes"
              placeholder="搜索物流节点"
            >
              <el-option
                v-for="node in nodes"
                :key="node.id"
                :label="node.name"
                :value="node.id"
              />
            </el-select> </el-form-item
        ></el-col>
        <el-col :span="12"
          ><el-form-item label="收货人" prop="receiverName"
            ><el-input
              v-model="form.receiverName"
              maxlength="100" /></el-form-item
        ></el-col>
        <el-col :span="12"
          ><el-form-item label="收货电话" prop="receiverPhone"
            ><el-input
              v-model="form.receiverPhone"
              maxlength="32" /></el-form-item
        ></el-col>
        <el-col :span="12"
          ><el-form-item label="计划送达时间">
            <span v-if="readonly">{{
              formatDateTime(order?.expectDeliveryTime)
            }}</span>
            <el-date-picker
              v-else
              v-model="deliveryTime"
              type="datetime"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="x"
              clearable
            /> </el-form-item
        ></el-col>
        <el-col :span="24"
          ><el-form-item label="备注"
            ><el-input
              v-model="form.remark"
              type="textarea"
              maxlength="1000" /></el-form-item
        ></el-col>
      </el-row>
      <p class="mb-3 text-sm text-(--el-text-color-secondary)">
        一个订单只有一个最终目的地。生成车次时自动带入提货信息；重量和体积为可选参考，未知值不按零计算。
      </p>
      <el-button v-if="!readonly" class="mb-3" @click="addItem"
        >添加商品行</el-button
      >
      <el-table :data="form.items" border>
        <el-table-column label="来源" width="110"
          ><template #default="{ row }">
            <span v-if="readonly">{{
              row.goodsSource === "SKU" ? "SKU" : "手工货物"
            }}</span>
            <el-select
              v-else
              v-model="row.goodsSource"
              @change="changeSource(row as OrderItem)"
              ><el-option label="手工货物" value="MANUAL" /><el-option
                label="SKU"
                value="SKU"
            /></el-select> </template
        ></el-table-column>
        <el-table-column label="商品名称 / SKU" min-width="230"
          ><template #default="{ row }">
            <span v-if="readonly"
              >{{ row.goodsName }}
              {{ row.skuCode ? "(" + row.skuCode + ")" : "" }}</span
            >
            <el-select
              v-else-if="row.goodsSource === 'SKU'"
              v-model="row.skuId"
              filterable
              remote
              :remote-method="searchSkus"
              :placeholder="row.goodsName || '搜索 SKU 编码'"
              @change="selectSku(row as OrderItem)"
            >
              <el-option
                v-for="sku in skus"
                :key="String(sku.skuId)"
                :value="String(sku.skuId)"
                :label="(sku.skuCode || '') + ' ' + (sku.name || '')"
              />
            </el-select>
            <el-input
              v-else
              v-model="row.goodsName"
              maxlength="255"
            /> </template
        ></el-table-column>
        <el-table-column label="规格" min-width="140"
          ><template #default="{ row }"
            ><span v-if="readonly || row.goodsSource === 'SKU'">{{
              row.specText || "-"
            }}</span
            ><el-input
              v-else
              v-model="row.specText"
              maxlength="1000" /></template
        ></el-table-column>
        <el-table-column label="计划数量" width="150"
          ><template #default="{ row }"
            ><span v-if="readonly">{{ row.orderedQuantity }}</span
            ><el-input
              v-else
              v-model="row.orderedQuantity"
              inputmode="numeric" /></template
        ></el-table-column>
        <el-table-column label="单位" width="90"
          ><template #default="{ row }"
            ><span v-if="readonly">{{ row.unit }}</span
            ><el-input v-else v-model="row.unit" maxlength="32" /></template
        ></el-table-column>
        <el-table-column label="参考重量 kg" width="150"
          ><template #default="{ row }"
            ><span v-if="readonly || row.goodsSource === 'SKU'">{{
              row.weightKg ?? "未知"
            }}</span
            ><el-input
              v-else
              v-model="row.weightKg"
              inputmode="decimal"
              placeholder="可空" /></template
        ></el-table-column>
        <el-table-column label="参考体积 cm³" width="150"
          ><template #default="{ row }"
            ><span v-if="readonly || row.goodsSource === 'SKU'">{{
              row.volumeCm3 ?? "未知"
            }}</span
            ><el-input
              v-else
              v-model="row.volumeCm3"
              inputmode="decimal"
              placeholder="可空" /></template
        ></el-table-column>
        <el-table-column v-if="!readonly" label="操作" width="70" fixed="right"
          ><template #default="{ $index }"
            ><el-button link type="danger" @click="form.items.splice($index, 1)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </el-form>
    <template v-if="readonly">
      <h4 class="my-4">逐行数量进度</h4>
      <p class="mb-3 text-sm text-(--el-text-color-secondary)">
        历史少备仅记录任务履约历史，不等于当前差额。签到后仍须卸货，最终仓卸货才计完成。
      </p>
      <el-table :data="form.items" border>
        <el-table-column prop="goodsName" label="商品" min-width="160" fixed />
        <el-table-column prop="unit" label="单位" width="70" />
        <el-table-column
          v-for="column in [
            ['plannedQuantity', '已分配数量'],
            ['reservedQuantity', '待提预留'],
            ['pickedQuantity', '已提'],
            ['loadedQuantity', '当前已装'],
            ['inTransitQuantity', '在途'],
            ['arrivedQuantity', '到站待卸'],
            ['completedQuantity', '已完成'],
            ['historicalShortageQuantity', '历史少备'],
            ['differenceQuantity', '关闭差异'],
            ['unfinishedQuantity', '未完成']
          ]"
          :key="column[0]"
          :prop="column[0]"
          :label="column[1]"
          min-width="110"
        />
      </el-table>
    </template>
    <OrderTransport
      v-if="open && readonly && order"
      :order-id="order.orderId"
    />
  </BusinessDialog>
</template>
