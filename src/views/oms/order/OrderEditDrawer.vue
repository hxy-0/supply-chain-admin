<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from "vue";
import { ElMessage } from "element-plus";
import {
  omsApi,
  type OmsOrder,
  type OrderInput,
  type OrderType,
  type OrderItemInput
} from "@/api/oms";
import { warehouseApi, type Warehouse } from "@/api/wms";
import { logisticNodeApi, type LogisticNode, type PageResult } from "@/api/tms";
import { pmsRequest, type Id } from "@/api/pms";

const visible = defineModel<boolean>({ default: false });
const props = defineProps<{ orderType: OrderType; order?: OmsOrder }>();
const emit = defineEmits<{ saved: [] }>();
type DraftLine = OrderItemInput & { skuCode: string; goodsName: string };
type Draft = Omit<
  OrderInput,
  "expectPickupTime" | "expectDeliveryTime" | "items"
> & {
  expectPickupTime: string;
  expectDeliveryTime: string;
  items: DraftLine[];
};
const empty = (): Draft => ({
  orderType: props.orderType,
  version: undefined,
  supplierName: "",
  pickupNodeId: undefined,
  sourceWarehouseId: undefined,
  targetWarehouseId: undefined,
  senderName: "",
  senderPhone: "",
  receiverName: "",
  receiverPhone: "",
  plannedPackageCount: 1,
  expectPickupTime: "",
  expectDeliveryTime: "",
  remark: "",
  items: []
});
const form = reactive<Draft>(empty());
const busy = shallowRef(false);
const warehouses = ref<Warehouse[]>([]);
const nodes = ref<LogisticNode[]>([]);
const skus = ref<{ sku: { skuId: Id; skuCode: string; name: string } }[]>([]);
const skuId = shallowRef<Id>();
const transfer = computed(() => props.orderType === "TRANSFER");
const heading = computed(
  () =>
    `${props.order ? "编辑" : "新建"}${transfer.value ? "调拨单" : "采购订单"}`
);
async function searchWarehouses(name = "") {
  try {
    warehouses.value = (
      await warehouseApi.page({ name, status: 0, pageNum: 1, pageSize: 100 })
    ).records;
  } catch (error) {
    notify(error);
  }
}
async function searchNodes(name = "") {
  try {
    nodes.value = (
      await logisticNodeApi.page({ name, pageNum: 1, pageSize: 100 })
    ).records;
  } catch (error) {
    notify(error);
  }
}
async function searchSkus(skuCode = "") {
  try {
    skus.value = (
      await pmsRequest<
        PageResult<{ sku: { skuId: Id; skuCode: string; name: string } }>
      >("get", "/skus", undefined, {
        skuCode,
        isEnable: 1,
        pageNum: 1,
        pageSize: 50
      })
    ).records;
  } catch (error) {
    notify(error);
  }
}
function contact(id: Id, side: "sender" | "receiver") {
  const warehouse = warehouses.value.find(row => String(row.id) === String(id));
  if (!warehouse) return;
  if (side === "sender") {
    form.senderName = warehouse.contactPerson || "";
    form.senderPhone = warehouse.contactPhone || "";
  } else {
    form.receiverName = warehouse.contactPerson || "";
    form.receiverPhone = warehouse.contactPhone || "";
  }
}
function addLine() {
  const sku = skus.value.find(
    row => String(row.sku.skuId) === String(skuId.value)
  )?.sku;
  if (!sku) {
    ElMessage.error("请先选择商品");
    return;
  }
  if (form.items.some(row => String(row.skuId) === String(sku.skuId))) {
    ElMessage.error("商品已添加");
    return;
  }
  if (form.items.length >= 200) {
    ElMessage.error("每单最多 200 行");
    return;
  }
  form.items.push({
    skuId: sku.skuId,
    skuCode: sku.skuCode,
    goodsName: sku.name,
    unit: "件",
    quantity: 1
  });
  skuId.value = undefined;
}
function opened() {
  Object.assign(form, empty());
  skuId.value = undefined;
  if (props.order) {
    const order = props.order;
    Object.assign(form, {
      orderType: order.orderType,
      supplierName: order.supplierName,
      pickupNodeId: transfer.value ? undefined : order.pickupNodeId,
      sourceWarehouseId: order.sourceWarehouseId,
      targetWarehouseId: order.targetWarehouseId,
      senderName: order.senderName,
      senderPhone: order.senderPhone,
      receiverName: order.receiverName,
      receiverPhone: order.receiverPhone,
      plannedPackageCount: order.plannedPackageCount,
      expectPickupTime: String(order.expectPickupTime),
      expectDeliveryTime: String(order.expectDeliveryTime),
      remark: order.remark,
      version: order.version,
      items: order.items.map(row => ({
        skuId: row.skuId,
        skuCode: row.skuCode,
        goodsName: row.goodsName,
        unit: row.unit,
        quantity: row.quantity
      }))
    });
  }
  void searchWarehouses();
  void searchNodes();
  void searchSkus();
}
function notify(error: unknown) {
  ElMessage.error(error instanceof Error ? error.message : "操作失败");
}
async function save() {
  if (
    !form.targetWarehouseId ||
    !form.senderName.trim() ||
    !form.senderPhone.trim() ||
    !form.receiverName.trim() ||
    !form.receiverPhone.trim() ||
    !form.items.length ||
    !form.expectPickupTime ||
    !form.expectDeliveryTime ||
    (transfer.value
      ? !form.sourceWarehouseId ||
        String(form.sourceWarehouseId) === String(form.targetWarehouseId)
      : !form.supplierName?.trim() || !form.pickupNodeId)
  ) {
    ElMessage.error(
      "请补全起讫地、联系人、计划时间与商品；调拨源仓和目标仓必须不同"
    );
    return;
  }
  const cmd: OrderInput = {
    ...form,
    orderType: props.orderType,
    supplierName: transfer.value ? undefined : form.supplierName,
    pickupNodeId: transfer.value ? undefined : form.pickupNodeId,
    sourceWarehouseId: transfer.value ? form.sourceWarehouseId : undefined,
    expectPickupTime: Number(form.expectPickupTime),
    expectDeliveryTime: Number(form.expectDeliveryTime),
    items: form.items.map(row => ({
      skuId: row.skuId,
      unit: row.unit,
      quantity: row.quantity
    }))
  };
  busy.value = true;
  try {
    if (props.order) await omsApi.update(props.order.orderId, cmd);
    else await omsApi.create(cmd);
    visible.value = false;
    emit("saved");
    ElMessage.success("草稿已保存");
  } catch (error) {
    notify(error);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <el-drawer
    v-model="visible"
    :title="heading"
    size="min(850px, 95vw)"
    :close-on-click-modal="false"
    :before-close="
      done => {
        if (!busy) done();
      }
    "
    destroy-on-close
    @open="opened"
  >
    <el-form label-width="105px" :disabled="busy" @submit.prevent="save">
      <el-form-item v-if="!transfer" label="供应商" required
        ><el-input v-model="form.supplierName" maxlength="128"
      /></el-form-item>
      <el-form-item v-if="!transfer" label="提货节点" required>
        <el-select
          v-model="form.pickupNodeId"
          filterable
          remote
          :remote-method="searchNodes"
          placeholder="搜索供应商提货节点"
        >
          <el-option
            v-if="order && !nodes.some(row => row.id === order.pickupNodeId)"
            :value="order.pickupNodeId"
            :label="order.pickupNodeName"
          />
          <el-option
            v-for="node in nodes"
            :key="node.id"
            :value="node.id"
            :label="node.name"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="transfer" label="源仓" required>
        <el-select
          v-model="form.sourceWarehouseId"
          filterable
          remote
          :remote-method="searchWarehouses"
          @change="id => contact(id, 'sender')"
        >
          <el-option
            v-if="
              order?.sourceWarehouseId &&
              !warehouses.some(
                row => String(row.id) === String(order.sourceWarehouseId)
              )
            "
            :value="order.sourceWarehouseId"
            :label="order.sourceWarehouseName"
          />
          <el-option
            v-for="warehouse in warehouses"
            :key="warehouse.id"
            :value="warehouse.id"
            :label="warehouse.name"
            :disabled="String(warehouse.id) === String(form.targetWarehouseId)"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="目标仓" required>
        <el-select
          v-model="form.targetWarehouseId"
          filterable
          remote
          :remote-method="searchWarehouses"
          @change="id => contact(id, 'receiver')"
        >
          <el-option
            v-if="
              order &&
              !warehouses.some(
                row => String(row.id) === String(order.targetWarehouseId)
              )
            "
            :value="order.targetWarehouseId"
            :label="order.targetWarehouseName"
          />
          <el-option
            v-for="warehouse in warehouses"
            :key="warehouse.id"
            :value="warehouse.id"
            :label="warehouse.name"
            :disabled="String(warehouse.id) === String(form.sourceWarehouseId)"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="发货联系人" required
        ><el-input v-model="form.senderName" maxlength="100"
      /></el-form-item>
      <el-form-item label="发货电话" required
        ><el-input v-model="form.senderPhone" maxlength="32"
      /></el-form-item>
      <el-form-item label="收货联系人" required
        ><el-input v-model="form.receiverName" maxlength="64"
      /></el-form-item>
      <el-form-item label="收货电话" required
        ><el-input v-model="form.receiverPhone" maxlength="32"
      /></el-form-item>
      <el-form-item label="计划包裹数" required
        ><el-input-number
          v-model="form.plannedPackageCount"
          :min="1"
          :max="2147483647"
          :precision="0"
      /></el-form-item>
      <el-form-item label="计划提货" required
        ><el-date-picker
          v-model="form.expectPickupTime"
          type="datetime"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="x"
      /></el-form-item>
      <el-form-item label="计划到货" required
        ><el-date-picker
          v-model="form.expectDeliveryTime"
          type="datetime"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="x"
      /></el-form-item>
      <el-form-item label="备注"
        ><el-input
          v-model="form.remark"
          type="textarea"
          maxlength="512"
          show-word-limit
      /></el-form-item>
      <el-form-item label="商品" required
        ><el-select
          v-model="skuId"
          filterable
          remote
          :remote-method="searchSkus"
          placeholder="搜索 SKU 编码"
          style="width: 330px"
          ><el-option
            v-for="row in skus"
            :key="row.sku.skuId"
            :value="row.sku.skuId"
            :label="row.sku.skuCode + ' · ' + row.sku.name" /></el-select
        ><el-button @click="addLine">添加</el-button></el-form-item
      >
      <el-table :data="form.items" row-key="skuId">
        <el-table-column prop="skuCode" label="SKU" min-width="140" />
        <el-table-column prop="goodsName" label="商品" min-width="140" />
        <el-table-column label="单位" width="100"
          ><template #default="{ row }"
            ><el-input
              v-model="row.unit"
              maxlength="32"
              aria-label="商品单位" /></template
        ></el-table-column>
        <el-table-column label="数量" width="180"
          ><template #default="{ row }"
            ><el-input-number
              v-model="row.quantity"
              :min="1"
              :max="2147483647"
              :precision="0"
              aria-label="需求数量" /></template
        ></el-table-column>
        <el-table-column width="70"
          ><template #default="{ $index }"
            ><el-button link type="danger" @click="form.items.splice($index, 1)"
              >移除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </el-form>
    <template #footer
      ><el-button :disabled="busy" @click="visible = false">取消</el-button
      ><el-button type="primary" :loading="busy" @click="save"
        >保存草稿</el-button
      ></template
    >
  </el-drawer>
</template>
