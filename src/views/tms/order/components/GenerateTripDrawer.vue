<script setup lang="ts">
import { computed, ref, watch, nextTick, onBeforeUnmount } from "vue";
import Sortable from "sortablejs";
import { ElMessage } from "element-plus";
import BusinessDrawer from "@/components/Tms/BusinessDrawer.vue";
import {
  carrierApi,
  logisticNodeApi,
  type Carrier,
  type LogisticNode
} from "@/api/tms";
import { orderApi, type TmsOrder } from "@/api/tmsOrder";
import { pickupApi, type GenerateTripCommand } from "@/api/tmsPickup";
import { enumCode, nodeTypes } from "../../fleet/definitions";
import { formatDateTime } from "@/utils/date";
import {
  validQuantity,
  availablePickupQuantity,
  pickupAllocationError,
  sortedPickupOrders,
  buildOrderTripRoute,
  tripRouteError
} from "../presentation";

const open = defineModel<boolean>({ required: true });
const props = defineProps<{ orderIds: string[] }>();
const emit = defineEmits<{ saved: [] }>();
const busy = ref(false);
const loading = ref(false);
const orders = ref<TmsOrder[]>([]);
const items = computed(() =>
  orders.value.flatMap(order =>
    order.items.map(item => ({ ...item, orderNo: order.orderNo }))
  )
);
const carriers = ref<Carrier[]>([]);
const nodes = ref<LogisticNode[]>([]);
const quantities = ref<Record<string, string>>({});
const packageCounts = ref<Record<string, number | undefined>>({});
const form = ref<GenerateTripCommand>(empty());
const warehouses = computed(() =>
  nodes.value.filter(node =>
    [1, 2, 3].includes(Number(enumCode(node.nodeType, nodeTypes)))
  )
);
function empty(): GenerateTripCommand {
  return {
    orderIds: props.orderIds,
    transportOrganizationType: "DIRECT",
    carrierId: "",
    stops: [],
    items: [],
    orderPickups: []
  };
}
function error(reason: unknown) {
  ElMessage.error(reason instanceof Error ? reason.message : "操作失败");
}
async function searchCarriers(name = "") {
  try {
    carriers.value = (
      await carrierApi.page({ name, pageNum: 1, pageSize: 50 })
    ).records;
  } catch (reason) {
    error(reason);
  }
}
async function searchNodes(name = "") {
  try {
    const result = await logisticNodeApi.page({
      name,
      pageNum: 1,
      pageSize: 100
    });
    nodes.value = [
      ...new Map(
        [...nodes.value, ...result.records].map(node => [node.id, node])
      ).values()
    ];
  } catch (reason) {
    error(reason);
  }
}
watch(open, async value => {
  if (!value) return;
  form.value = empty();
  quantities.value = {};
  packageCounts.value = {};
  orders.value = [];
  nodes.value = [];
  loading.value = true;
  try {
    const [detail] = await Promise.all([
      Promise.all(props.orderIds.map(id => orderApi.detail(id))),
      searchCarriers(),
      searchNodes()
    ]);
    orders.value = sortedPickupOrders(detail);
    for (const order of orders.value) {
      packageCounts.value[order.orderId] = order.plannedPackageCount;
    }
    resetRoute();
    for (const item of items.value) {
      const remaining = availablePickupQuantity(
        item.orderedQuantity,
        item.plannedQuantity
      );
      if (remaining !== "0") quantities.value[item.orderItemId] = remaining;
    }
  } catch (reason) {
    error(reason);
  } finally {
    loading.value = false;
  }
});
function planMissing(order: TmsOrder) {
  return (
    !order.pickupNodeId ||
    !order.senderName ||
    !order.senderPhone ||
    !order.plannedPackageCount ||
    order.expectPickupTime == null
  );
}
const routeTableRef = ref();
let routeSortable: Sortable | undefined;
let routeKey = 0;
const routeKeys = new WeakMap<object, string>();
function rowKey(row: object) {
  if (!routeKeys.has(row)) routeKeys.set(row, String(++routeKey));
  return routeKeys.get(row)!;
}
function resetRoute() {
  const warehouse =
    form.value.transportOrganizationType === "TRANSFER"
      ? nodes.value.find(node => node.id === form.value.transferNodeId)
      : undefined;
  form.value.stops =
    form.value.transportOrganizationType === "TRANSFER" && !warehouse
      ? []
      : buildOrderTripRoute(orders.value, warehouse);
}
watch(
  () => [form.value.transportOrganizationType, form.value.transferNodeId],
  resetRoute
);
watch(
  () => form.value.stops,
  async () => {
    await nextTick();
    routeSortable?.destroy();
    const body = routeTableRef.value?.$el.querySelector(
      ".el-table__body-wrapper tbody"
    );
    if (!body) return;
    routeSortable = Sortable.create(body, {
      handle: ".drag-handle",
      animation: 150,
      onEnd: ({ oldIndex, newIndex }) => {
        if (
          busy.value ||
          oldIndex == null ||
          newIndex == null ||
          oldIndex === newIndex
        )
          return;
        const [stop] = form.value.stops.splice(oldIndex, 1);
        form.value.stops.splice(newIndex, 0, stop);
      }
    });
  }
);
onBeforeUnmount(() => routeSortable?.destroy());
function addStop() {
  form.value.stops.splice(Math.max(1, form.value.stops.length - 1), 0, {
    nodeId: "",
    pickup: false
  });
}
async function save() {
  if (
    !orders.value.length ||
    orders.value.some(order => !["PENDING", "EXECUTING"].includes(order.status))
  )
    return ElMessage.warning("选中订单已送达、已完成或已取消，不能生成车次");
  const requested = items.value
    .filter(item => quantities.value[item.orderItemId]?.trim())
    .map(item => ({
      orderItemId: item.orderItemId,
      plannedQuantity: quantities.value[item.orderItemId].trim()
    }));
  if (
    !requested.length ||
    requested.some(item => !validQuantity(item.plannedQuantity, true))
  )
    return ElMessage.warning("请选择本次提货明细并填写正整数数量");
  for (const item of items.value) {
    const quantity = quantities.value[item.orderItemId]?.trim();
    if (!quantity) continue;
    const message = pickupAllocationError(
      item.orderedQuantity,
      item.plannedQuantity,
      quantity
    );
    if (message)
      return ElMessage.warning(
        `${item.orderNo} · ${item.goodsName}：${message}`
      );
  }
  if (
    orders.value.some(
      order =>
        !order.items.some(item =>
          requested.some(line => line.orderItemId === item.orderItemId)
        )
    )
  )
    return ElMessage.warning(
      "每个选中订单至少需要一项本次提货商品；已全部占用的订单请取消勾选"
    );
  if (!form.value.carrierId || orders.value.some(planMissing))
    return ElMessage.warning("请选择承运人，订单发货信息及计划必须完整");
  if (
    orders.value.some(
      order =>
        !Number.isInteger(packageCounts.value[order.orderId]) ||
        !validQuantity(packageCounts.value[order.orderId], true) ||
        packageCounts.value[order.orderId]! > 2147483647
    )
  )
    return ElMessage.warning(
      "请为每个订单填写本次计划提货包裹数，必须为正整数"
    );
  if (
    form.value.transportOrganizationType === "TRANSFER" &&
    !form.value.transferNodeId
  )
    return ElMessage.warning("中转运输请选择转运仓");
  const destinations =
    form.value.transportOrganizationType === "TRANSFER"
      ? [form.value.transferNodeId!]
      : orders.value.map(order => order.destinationNodeId);
  const routeError = tripRouteError(
    form.value.stops,
    orders.value,
    destinations
  );
  if (routeError) return ElMessage.warning(routeError);
  busy.value = true;
  try {
    const trip = await pickupApi.generateTrip({
      ...form.value,
      orderIds: props.orderIds,
      items: requested,
      orderPickups: orders.value.map(order => ({
        orderId: order.orderId,
        plannedPackageCount: packageCounts.value[order.orderId]!
      })),
      transferNodeId:
        form.value.transportOrganizationType === "TRANSFER"
          ? form.value.transferNodeId
          : undefined,
      stops: form.value.stops.map(stop => ({
        nodeId: stop.nodeId,
        pickup: stop.pickup,
        plannedArrivalTime: Number(stop.plannedArrivalTime),
        plannedDepartureTime:
          stop.plannedDepartureTime == null || stop.plannedDepartureTime === ""
            ? undefined
            : Number(stop.plannedDepartureTime)
      }))
    });
    ElMessage.success(
      `车次 ${trip.tripNo} 已生成，共 ${trip.pickupTaskIds.length} 个提货任务`
    );
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
  <BusinessDrawer
    v-model="open"
    title="生成车次"
    size="90%"
    :busy="busy || loading"
  >
    <div v-loading="loading">
      <el-alert
        :title="`已选择 ${orders.length} 个订单，默认运输尚未提货且未占用的商品。`"
        type="info"
        :closable="false"
        class="mb-4"
      />
      <el-form label-width="110px" :disabled="busy || loading">
        <el-form-item label="运输组织方式"
          ><el-radio-group v-model="form.transportOrganizationType"
            ><el-radio-button value="DIRECT">直达运输</el-radio-button
            ><el-radio-button value="TRANSFER"
              >中转运输</el-radio-button
            ></el-radio-group
          ></el-form-item
        >
        <el-form-item label="运输终点">
          <el-select
            v-if="form.transportOrganizationType === 'TRANSFER'"
            v-model="form.transferNodeId"
            filterable
            remote
            :remote-method="searchNodes"
            placeholder="选择送往的转运仓"
            ><el-option
              v-for="node in warehouses"
              :key="node.id"
              :value="node.id"
              :label="node.name"
          /></el-select>
          <span v-else
            >{{
              orders
                .map(
                  order => order.destinationNodeName || order.destinationNodeId
                )
                .join(" → ")
            }}（订单目的地）</span
          >
        </el-form-item>
        <el-form-item label="承运人"
          ><el-select
            v-model="form.carrierId"
            filterable
            remote
            :remote-method="searchCarriers"
            ><el-option
              v-for="carrier in carriers"
              :key="carrier.id"
              :label="carrier.name"
              :value="carrier.id" /></el-select
        ></el-form-item>
        <h4 class="my-4">订单运输信息</h4>
        <el-table :data="orders" border>
          <el-table-column type="index" label="顺序" width="65" />
          <el-table-column prop="orderNo" label="订单号" min-width="200" />
          <el-table-column prop="senderName" label="发货人" min-width="120" />
          <el-table-column label="计划提货时间" min-width="180"
            ><template #default="{ row }">{{
              formatDateTime(row.expectPickupTime)
            }}</template></el-table-column
          >
          <el-table-column label="提货点" min-width="140"
            ><template #default="{ row }">{{
              row.pickupNodeName || row.pickupNodeId || "待补充"
            }}</template></el-table-column
          >
          <el-table-column
            prop="pickupAddress"
            label="提货地址"
            min-width="220"
          />
          <el-table-column
            prop="plannedPackageCount"
            label="计划包裹数"
            width="120"
          />
          <el-table-column
            prop="senderPhone"
            label="发货电话"
            min-width="130"
          />
          <el-table-column prop="receiverName" label="收货人" min-width="120" />
          <el-table-column
            prop="receiverPhone"
            label="收货电话"
            min-width="130"
          />
        </el-table>
        <section
          v-for="order in orders"
          :key="order.orderId"
          class="order-goods"
        >
          <div class="order-goods-heading">
            <strong>{{ order.orderNo }}</strong
            ><span
              >发货人：{{ order.senderName }} → 收货人：{{
                order.receiverName
              }}</span
            ><span>订单计划包裹数：{{ order.plannedPackageCount }}</span>
            <label class="flex items-center gap-2">
              本次计划提货包裹数
              <el-input-number
                v-model="packageCounts[order.orderId]"
                :min="1"
                :max="2147483647"
                :precision="0"
                :step="1"
                step-strictly
                :aria-label="`${order.orderNo} 本次计划提货包裹数`"
              />
            </label>
          </div>
          <el-table :data="order.items" border>
            <el-table-column prop="goodsName" label="商品" min-width="200" />
            <el-table-column prop="unit" label="单位" width="80" />
            <el-table-column prop="orderedQuantity" label="订单数量" />
            <el-table-column prop="plannedQuantity" label="已分配数量" />
            <el-table-column label="剩余可分配">
              <template #default="{ row }">{{
                availablePickupQuantity(
                  row.orderedQuantity,
                  row.plannedQuantity
                )
              }}</template>
            </el-table-column>
            <el-table-column label="本次分配数量" min-width="180"
              ><template #default="{ row }"
                ><el-input
                  v-model="quantities[row.orderItemId]"
                  inputmode="numeric"
                  :disabled="
                    availablePickupQuantity(
                      row.orderedQuantity,
                      row.plannedQuantity
                    ) === '0'
                  "
                  :aria-label="row.goodsName + ' 本次分配数量'"
                  :placeholder="
                    availablePickupQuantity(
                      row.orderedQuantity,
                      row.plannedQuantity
                    ) === '0'
                      ? '已全部分配'
                      : '填写本次分配数量'
                  " /></template
            ></el-table-column>
          </el-table>
        </section>
        <div class="flex-bc my-4">
          <h3>车次线路节点与计划时刻</h3>
          <el-button
            :disabled="form.stops.length < 2 || form.stops.length >= 400"
            @click="addStop"
            >添加经停点</el-button
          >
        </div>
        <el-table
          ref="routeTableRef"
          :data="form.stops"
          border
          :row-key="rowKey"
        >
          <el-table-column width="44" align="center"
            ><template #default
              ><span class="drag-handle" title="拖动调整顺序">⠿</span></template
            ></el-table-column
          >
          <el-table-column label="节点" min-width="260"
            ><template #default="{ row, $index }">
              <div class="node-role">
                {{
                  $index === 0
                    ? "始发点"
                    : $index === form.stops.length - 1
                      ? "终点"
                      : "经停点"
                }}
                <template v-if="row.pickup"> · 提货点</template>
              </div>
              <el-select
                v-model="row.nodeId"
                filterable
                remote
                :remote-method="searchNodes"
                :disabled="
                  Boolean(row.pickup) ||
                  orders.some(
                    order => order.destinationNodeId === row.nodeId
                  ) ||
                  row.nodeId === form.transferNodeId
                "
              >
                <el-option
                  v-for="node in nodes"
                  :key="node.id"
                  :value="node.id"
                  :label="node.name"
                />
                <el-option
                  v-if="
                    row.nodeId && !nodes.some(node => node.id === row.nodeId)
                  "
                  :value="row.nodeId"
                  :label="row.nodeName || row.nodeId"
                />
              </el-select> </template
          ></el-table-column>
          <el-table-column label="到达时间" min-width="240"
            ><template #default="{ row }"
              ><el-date-picker
                v-model="row.plannedArrivalTime"
                type="datetime"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="x"
                placeholder="计划到达时间" /></template
          ></el-table-column>
          <el-table-column label="发车时间" min-width="240"
            ><template #default="{ row, $index }"
              ><el-date-picker
                v-model="row.plannedDepartureTime"
                type="datetime"
                format="YYYY-MM-DD HH:mm:ss"
                value-format="x"
                :placeholder="
                  $index === form.stops.length - 1
                    ? '终点可不填'
                    : '计划发车时间'
                " /></template
          ></el-table-column>
          <el-table-column label="操作" width="80" align="center"
            ><template #default="{ row, $index }"
              ><el-button
                v-if="
                  !row.pickup &&
                  !orders.some(
                    order => order.destinationNodeId === row.nodeId
                  ) &&
                  row.nodeId !== form.transferNodeId
                "
                circle
                aria-label="删除经停点"
                @click="form.stops.splice($index, 1)"
                >−</el-button
              ></template
            ></el-table-column
          >
        </el-table>
        <p class="my-3 text-sm">
          同点订单合并停靠，到达取最早时间、发车取最晚时间；可调整节点顺序及时间。跨节点时间冲突由调度人员处理，不拦截保存。
        </p>

        <p class="mt-4 text-sm">
          {{
            form.transportOrganizationType === "DIRECT"
              ? "一个车次，同一提货点合并一个提货任务，同一卸货点合并一个卸货任务；明细保留各订单商品来源。"
              : "按计划提货顺序完成各点提货，再送往所选转运仓，到仓后的货物再按班次组织运输。"
          }}
        </p>
      </el-form>
    </div>
    <template #footer>
      <el-button :disabled="busy || loading" @click="open = false"
        >取消</el-button
      >
      <el-button
        type="primary"
        :loading="busy"
        :disabled="loading || !orders.length"
        @click="save"
        >生成车次</el-button
      >
    </template>
  </BusinessDrawer>
</template>

<style scoped>
.drag-handle {
  font-size: 20px;
  color: var(--el-text-color-secondary);
  cursor: grab;
}

.node-role {
  margin-bottom: 6px;
  color: var(--el-text-color-secondary);
}

.order-goods {
  margin-top: 24px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
}

.order-goods-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding: 16px;
  background: var(--el-fill-color-light);
}

.order-goods-heading span {
  color: var(--el-text-color-regular);
}
</style>
