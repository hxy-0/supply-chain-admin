<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { formatDateTime } from "@/utils/date";
import { statusLabels, formatWeight, formatVolume } from "../presentation";
import { ElMessage } from "element-plus";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import {
  orderApi,
  type ExpressOrder,
  type OrderCommand,
  type OrderItem
} from "@/api/tmsOrder";
import { pmsRequest, type Sku } from "@/api/pms";
import type { PageResult } from "@/api/tms";
const tempLabels: Record<number, string> = {
  1: "常温",
  2: "冷藏",
  3: "水产",
  4: "工业品"
};
const open = defineModel<boolean>({ required: true });
const props = defineProps<{ order: ExpressOrder; readonly: boolean }>();
const emit = defineEmits<{ saved: [] }>();
const form = ref<OrderCommand>();
const busy = ref(false);
const ready = ref(false);
const options = ref<Sku[]>([]);
const weight = computed(
  () =>
    form.value?.items.reduce(
      (sum, item) => sum + Number(item.weightKg || 0),
      0
    ) || 0
);
const volume = computed(
  () =>
    (form.value?.items.reduce(
      (sum, item) => sum + Number(item.volumeCm3 || 0),
      0
    ) || 0) / 1_000_000
);
async function search(code = "") {
  try {
    const results = (
      await pmsRequest<PageResult<{ sku: Sku }>>("get", "/skus", undefined, {
        skuCode: code,
        isEnable: 1,
        pageNum: 1,
        pageSize: 50
      })
    ).records.map(row => row.sku);
    options.value = [
      ...new Map(
        [...options.value, ...results].map(sku => [String(sku.skuId), sku])
      ).values()
    ];
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : "SKU查询失败");
  }
}
function recalculate(item: OrderItem) {
  if (item.goodsSource !== 1) return;
  const sku = options.value.find(
    sku => String(sku.skuId) === String(item.skuId)
  );
  if (!sku) return;
  item.goodsName = sku.name || "";
  item.skuCode = sku.skuCode;
  item.specText = sku.specText;
  item.weightKg = Number(
    (Number(sku.weightKg || 0) * item.quantity).toFixed(4)
  );
  item.volumeCm3 = Number(
    (
      Number(sku.lengthCm || 0) *
      Number(sku.widthCm || 0) *
      Number(sku.heightCm || 0) *
      item.quantity
    ).toFixed(4)
  );
}
watch(
  open,
  async value => {
    if (!value) return;
    ready.value = false;
    const order = props.order;
    form.value = {
      pickupType: order.pickupType,
      tempZone: order.tempZone,
      senderName: order.sender.name,
      senderPhone: order.sender.phone,
      senderAddress: order.senderAddress.formattedAddress,
      senderProvince: order.senderAddress.province,
      senderCity: order.senderAddress.city,
      senderDistrict: order.senderAddress.district,
      senderAdCode: order.senderAddress.adCode,
      receiverName: order.receiver.name,
      receiverPhone: order.receiver.phone,
      receiverAddress: order.receiverAddress.formattedAddress,
      receiverProvince: order.receiverAddress.province,
      receiverCity: order.receiverAddress.city,
      receiverDistrict: order.receiverAddress.district,
      receiverAdCode: order.receiverAddress.adCode,
      expectPickupTime: order.expectPickupTime,
      expectDeliveryTime: order.expectDeliveryTime,
      remark: order.remark,
      items: order.items.map(item => ({ ...item }))
    };
    if (props.readonly) {
      ready.value = true;
      return;
    }
    try {
      const skus = await Promise.all(
        form.value.items
          .filter(item => item.goodsSource === 1)
          .map(item => pmsRequest<Sku>("get", `/skus/${item.skuId}`))
      );
      options.value = skus;
      form.value.items.forEach(recalculate);
      ready.value = true;
    } catch (reason) {
      ElMessage.error(reason instanceof Error ? reason.message : "SKU加载失败");
    }
  },
  { immediate: true }
);
function add(source: number) {
  form.value?.items.push({
    goodsSource: source,
    goodsName: "",
    quantity: 1,
    unit: source === 1 ? "台" : "件",
    actualQuantity: 0,
    remainingQuantity: 1
  });
  if (source === 1) void search();
}
async function save() {
  if (props.readonly || !form.value || busy.value || !ready.value) return;
  const data = form.value;
  if (
    ![
      data.senderName,
      data.senderPhone,
      data.senderAddress,
      data.receiverName,
      data.receiverPhone,
      data.receiverAddress
    ].every(value => value.trim()) ||
    !data.items.length ||
    data.items.some(
      item =>
        !item.goodsName.trim() ||
        !item.unit.trim() ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.weightKg) ||
        Number(item.weightKg) <= 0 ||
        !Number.isFinite(item.volumeCm3) ||
        Number(item.volumeCm3) <= 0
    )
  ) {
    ElMessage.warning(
      "请填写联系人、地址及有效货物数量、重量、体积；SKU需维护重量和长宽高"
    );
    return;
  }
  if (
    data.expectPickupTime &&
    data.expectDeliveryTime &&
    Number(data.expectDeliveryTime) < Number(data.expectPickupTime)
  ) {
    ElMessage.warning("计划送达不能早于计划提货");
    return;
  }
  busy.value = true;
  try {
    await orderApi.update(props.order.orderId, {
      ...data,
      expectPickupTime: data.expectPickupTime
        ? Number(data.expectPickupTime)
        : undefined,
      expectDeliveryTime: data.expectDeliveryTime
        ? Number(data.expectDeliveryTime)
        : undefined
    });
    ElMessage.success("订单已更新");
    open.value = false;
    emit("saved");
  } catch (reason) {
    ElMessage.error(reason instanceof Error ? reason.message : "保存失败");
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <BusinessDialog
    v-model="open"
    :title="readonly ? '订单详情' : '编辑订单'"
    :readonly="readonly"
    width="1100px"
    :busy="busy"
    @submit="save"
  >
    <el-form
      v-if="form"
      label-width="120px"
      :disabled="readonly || busy || !ready"
    >
      <el-row :gutter="16">
        <el-col :span="12"
          ><el-form-item label="订单号"
            ><span>{{ order.orderNo }}</span></el-form-item
          ></el-col
        >
        <el-col :span="12"
          ><el-form-item label="状态"
            ><el-tag>{{ statusLabels[order.status] }}</el-tag></el-form-item
          ></el-col
        >
      </el-row>
      <el-row :gutter="16"
        ><el-col :span="12"
          ><el-form-item label="发货联系人"
            ><span v-if="readonly">{{ form.senderName || "—" }}</span
            ><el-input
              v-else
              v-model="form.senderName"
              maxlength="64" /></el-form-item
          ><el-form-item label="发货电话"
            ><span v-if="readonly">{{ form.senderPhone || "—" }}</span
            ><el-input
              v-else
              v-model="form.senderPhone"
              maxlength="32" /></el-form-item
          ><el-form-item label="提货地址"
            ><span v-if="readonly">{{ form.senderAddress || "—" }}</span
            ><el-input v-else v-model="form.senderAddress" /></el-form-item
        ></el-col>
        <el-col :span="12"
          ><el-form-item label="收货联系人"
            ><span v-if="readonly">{{ form.receiverName || "—" }}</span
            ><el-input
              v-else
              v-model="form.receiverName"
              maxlength="64" /></el-form-item
          ><el-form-item label="收货电话"
            ><span v-if="readonly">{{ form.receiverPhone || "—" }}</span
            ><el-input
              v-else
              v-model="form.receiverPhone"
              maxlength="32" /></el-form-item
          ><el-form-item label="送货地址"
            ><span v-if="readonly">{{ form.receiverAddress || "—" }}</span
            ><el-input
              v-else
              v-model="form.receiverAddress" /></el-form-item></el-col
      ></el-row>
      <el-row :gutter="16">
        <el-col :span="12"
          ><el-form-item label="计划提货时间"
            ><span v-if="readonly">{{
              formatDateTime(form.expectPickupTime)
            }}</span
            ><el-date-picker
              v-else
              v-model="form.expectPickupTime"
              type="datetime"
              value-format="x"
              format="YYYY-MM-DD HH:mm:ss"
              style="width: 100%" /></el-form-item
        ></el-col>
        <el-col :span="12"
          ><el-form-item label="计划送达时间"
            ><span v-if="readonly">{{
              formatDateTime(form.expectDeliveryTime)
            }}</span
            ><el-date-picker
              v-else
              v-model="form.expectDeliveryTime"
              type="datetime"
              value-format="x"
              format="YYYY-MM-DD HH:mm:ss"
              style="width: 100%" /></el-form-item
        ></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12"
          ><el-form-item label="实际提货时间"
            ><span>{{
              formatDateTime(order.actualPickupTime)
            }}</span></el-form-item
          ></el-col
        >
        <el-col :span="12"
          ><el-form-item label="提货完成时间"
            ><span>{{
              formatDateTime(order.actualCompletionTime)
            }}</span></el-form-item
          ></el-col
        >
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12"
          ><el-form-item label="温区"
            ><span>{{ tempLabels[order.tempZone] }}</span></el-form-item
          ></el-col
        >
        <el-col :span="12"
          ><el-form-item label="取件方式"
            ><span>{{
              order.pickupType === 1 ? "上门取件" : "自送驿站"
            }}</span></el-form-item
          ></el-col
        >
      </el-row>
      <el-form-item v-if="order.cancelReason" label="取消原因"
        ><span>{{ order.cancelReason }}</span></el-form-item
      >
      <el-form-item label="备注"
        ><span v-if="readonly">{{ form.remark || "—" }}</span
        ><el-input v-else v-model="form.remark" maxlength="255"
      /></el-form-item>
      <el-divider content-position="left">计划货物明细</el-divider>
      <el-table :data="form.items">
        <el-table-column label="货物 / SKU" min-width="240"
          ><template #default="{ row }"
            ><span v-if="readonly"
              >{{ row.skuCode ? `${row.skuCode} ` : ""
              }}{{ row.goodsName }}</span
            ><el-select
              v-else-if="row.goodsSource === 1"
              v-model="row.skuId"
              filterable
              remote
              :remote-method="search"
              @change="recalculate(row as OrderItem)"
              ><el-option
                v-for="sku in options"
                :key="String(sku.skuId)"
                :label="`${sku.skuCode} ${sku.name}`"
                :value="sku.skuId!" /></el-select
            ><el-input
              v-else
              v-model="row.goodsName"
              placeholder="货物名称" /></template
        ></el-table-column>
        <el-table-column label="规格" min-width="180"
          ><template #default="{ row }"
            ><span v-if="readonly || row.goodsSource === 1">{{
              row.specText
            }}</span
            ><el-input v-else v-model="row.specText" /></template
        ></el-table-column>
        <el-table-column label="数量" width="140"
          ><template #default="{ row }"
            ><span v-if="readonly">{{ row.quantity }}</span
            ><el-input-number
              v-else
              v-model="row.quantity"
              :min="0.0001"
              :precision="4"
              :controls="false"
              style="width: 110px"
              @change="recalculate(row as OrderItem)" /></template
        ></el-table-column>
        <el-table-column label="单位" width="85"
          ><template #default="{ row }"
            ><span v-if="readonly">{{ row.unit }}</span
            ><el-input v-else v-model="row.unit" maxlength="32" /></template
        ></el-table-column>
        <el-table-column label="计划重量(kg)" width="140"
          ><template #default="{ row }"
            ><span v-if="readonly || row.goodsSource === 1">{{
              formatWeight(row.weightKg)
            }}</span
            ><el-input-number
              v-else
              v-model="row.weightKg"
              :min="0.001"
              :precision="3"
              :controls="false"
              style="width: 110px" /></template
        ></el-table-column>
        <el-table-column label="计划体积(m³)" width="140"
          ><template #default="{ row }"
            ><span v-if="readonly || row.goodsSource === 1">{{
              formatVolume(row.volumeCm3)
            }}</span
            ><el-input-number
              v-else
              :model-value="Number(row.volumeCm3 || 0) / 1_000_000"
              :min="0.01"
              :precision="2"
              :controls="false"
              style="width: 110px"
              @update:model-value="
                value => (row.volumeCm3 = Number(value) * 1_000_000)
              " /></template
        ></el-table-column>
        <el-table-column
          v-if="readonly"
          prop="actualQuantity"
          label="已提数量"
          width="95"
        /><el-table-column
          v-if="readonly"
          prop="remainingQuantity"
          label="剩余数量"
          width="95"
        /><el-table-column v-if="!readonly" label="操作" width="65"
          ><template #default="scope"
            ><el-button
              link
              type="danger"
              @click="form.items.splice(scope.$index, 1)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-button v-if="!readonly" @click="add(1)">添加 SKU</el-button
      ><el-button v-if="!readonly" @click="add(0)">添加手工货物</el-button>
      <div style="margin-top: 12px">
        合计：{{ formatWeight(weight) }} kg / {{ volume.toFixed(2) }} m³
      </div>
    </el-form>
  </BusinessDialog>
</template>
