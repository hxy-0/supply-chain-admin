<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { carrierApi, driverApi, logisticNodeApi, vehicleApi } from "@/api/tms";
import { message } from "@/utils/message";
import FleetEditDialog from "./components/FleetEditDialog.vue";
import DriverBindDialog from "./components/DriverBindDialog.vue";
import DriverSensitiveDialog from "./components/DriverSensitiveDialog.vue";
import { hasPerms } from "@/utils/auth";
import {
  definitions,
  enumCode,
  optionLabel,
  type FleetKind
} from "./definitions";
defineOptions({ name: "TmsFleet" });
const route = useRoute();
const kind = computed<FleetKind>(
  () =>
    (({
      driver: "drivers",
      carrier: "carriers",
      vehicle: "vehicles",
      "logistic-node": "logisticNode"
    })[route.path.split("/").pop()] as FleetKind) || "drivers"
);
const def = computed(() => definitions[kind.value]);
const apis = {
  drivers: driverApi,
  carriers: carrierApi,
  vehicles: vehicleApi,
  logisticNode: logisticNodeApi
};
const rows = ref<Record<string, any>[]>([]),
  carriers = ref<{ id: string; name: string }[]>([]);
const query = ref<Record<string, any>>({ pageNum: 1, pageSize: 10 });
const total = ref(0),
  loading = ref(false),
  editOpen = ref(false),
  bindOpen = ref(false);
const sensitiveOpen = ref(false);
const sensitiveDriver = ref<Record<string, any>>();
const editing = ref<Record<string, any>>(),
  binding = ref<Record<string, any>>();
let requestId = 0;
const statusSaving = ref(new Set<string>());
const filters = computed(() =>
  def.value.filters.map(key => def.value.fields.find(f => f.key === key))
);
/** 物流节点列表：经纬度合并成一列，城市编码与地址换位，其余页面按字段原样展示 */
const tableFields = computed(() => {
  const fields = def.value.fields.filter(
    f =>
      !(
        kind.value === "logisticNode" &&
        ["longitude", "latitude", "cityIp"].includes(f.key)
      )
  );
  if (kind.value === "carriers") {
    const nameIndex = fields.findIndex(f => f.key === "name");
    const abbrIndex = fields.findIndex(f => f.key === "abbrName");
    [fields[nameIndex], fields[abbrIndex]] = [
      fields[abbrIndex],
      fields[nameIndex]
    ];
  }
  return fields;
});
/** 物流节点地址列：优先详细地址，兜底省市区拼接 */
function addressText(row: Record<string, any>) {
  const address = row.address || {};
  return (
    address.formattedAddress ||
    [address.province, address.city, address.district]
      .filter(Boolean)
      .join("") ||
    ""
  );
}
function addressRegion(row: Record<string, any>) {
  const address = row.address || {};
  return [address.province, address.city, address.district]
    .filter(Boolean)
    .join(" / ");
}
function displayField(row: Record<string, any>, key: string) {
  const value = row[key];
  if (
    kind.value !== "drivers" ||
    !["phone", "idCard", "driverLicense"].includes(key)
  )
    return value ?? "-";
  if (!value) return "-";
  const text = String(value);
  if (text.includes("*")) return text;
  return text.length <= 7
    ? "*".repeat(text.length)
    : `${text.slice(0, 3)}${"*".repeat(text.length - 7)}${text.slice(-4)}`;
}
async function load() {
  const version = ++requestId;
  const current = kind.value;
  loading.value = true;
  try {
    const data = { ...query.value };
    for (const key of Object.keys(data))
      if (typeof data[key] === "string")
        data[key] = data[key].trim() || undefined;
    const page = await apis[current].page(data);
    if (version !== requestId) return;
    rows.value = page.records;
    total.value = page.total;
  } finally {
    if (version === requestId) loading.value = false;
  }
}
async function loadCarriers() {
  const list: { id: string; name: string }[] = [];
  let pageNum = 1;
  while (true) {
    const page = await carrierApi.page({ pageNum, pageSize: 100 });
    list.push(...page.records);
    if (!page.records.length || list.length >= page.total) break;
    pageNum++;
  }
  carriers.value = list;
}
function edit(row?: Record<string, any>) {
  editing.value = row;
  editOpen.value = true;
}
function report(error: unknown) {
  message(String(error), { type: "error" });
}
async function remove(row: Record<string, any>) {
  try {
    await apis[kind.value].remove(row.id);
    if (rows.value.length === 1 && query.value.pageNum > 1)
      query.value.pageNum--;
    await load();
    message("删除成功", { type: "success" });
  } catch (error) {
    report(error);
  }
}
function reset() {
  query.value = { pageNum: 1, pageSize: 10 };
  load().catch(report);
}
async function toggle(
  row: Record<string, any>,
  status: string | number | boolean
) {
  if (statusSaving.value.has(row.id)) return;
  statusSaving.value.add(row.id);
  try {
    const current = kind.value;
    const data = { ...row, status: Number(status) };
    for (const field of definitions[current].fields) {
      if (field.options && field.key !== "status")
        data[field.key] = enumCode(row[field.key], field.options);
    }
    await apis[current].save(data);
    row.status = Number(status);
  } catch (error) {
    report(error);
  } finally {
    statusSaving.value.delete(row.id);
  }
}
watch(kind, () => {
  editOpen.value = false;
  bindOpen.value = false;
  sensitiveOpen.value = false;
  rows.value = [];
  total.value = 0;
  reset();
  if (kind.value === "vehicles") loadCarriers().catch(report);
});
onMounted(() => {
  load().catch(report);
  loadCarriers().catch(report);
});
</script>
<template>
  <div>
    <el-card shadow="never" class="mb-4"
      ><el-form
        inline
        @submit.prevent="
          query.pageNum = 1;
          load().catch(report);
        "
      >
        <el-form-item v-for="field in filters" :key="field.key">
          <el-select
            v-if="field.key === 'carrierId'"
            v-model="query[field.key]"
            filterable
            clearable
            :placeholder="field.label"
            style="width: 180px"
            ><el-option
              v-for="c in carriers"
              :key="c.id"
              :value="c.id"
              :label="c.name"
          /></el-select>
          <el-select
            v-else-if="field.options"
            v-model="query[field.key]"
            clearable
            :placeholder="field.label"
            style="width: 150px"
            ><el-option
              v-for="o in field.options"
              :key="o.value"
              :value="o.value"
              :label="o.label"
          /></el-select>
          <el-input
            v-else
            v-model="query[field.key]"
            clearable
            :placeholder="field.label"
          /> </el-form-item
        ><el-form-item
          ><el-button type="primary" native-type="submit">查询</el-button
          ><el-button @click="reset">重置</el-button
          ><el-button type="success" @click="edit()"
            >新增{{ def.title }}</el-button
          ></el-form-item
        >
      </el-form></el-card
    >
    <el-card shadow="never"
      ><el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column
          v-for="field in tableFields"
          :key="field.key"
          :prop="field.key"
          :label="field.label"
          :fixed="
            (kind === 'drivers' && field.key === 'name') ||
            (kind === 'carriers' && field.key === 'abbrName')
              ? 'left'
              : undefined
          "
          :width="
            kind === 'carriers' && field.key === 'contactPerson'
              ? 90
              : kind === 'drivers' && field.key === 'name'
                ? 120
                : undefined
          "
          :min-width="field.tableMinWidth ?? 140"
          :class-name="
            kind === 'drivers' || field.key === 'unifiedSocialCreditCode'
              ? 'driver-cell'
              : undefined
          "
          ><template #default="s">
            <el-switch
              v-if="kind === 'drivers' && field.key === 'status'"
              :model-value="enumCode(s.row.status, field.options)"
              :active-value="0"
              :inactive-value="1"
              :loading="statusSaving.has(s.row.id)"
              :disabled="statusSaving.has(s.row.id)"
              active-text="启用"
              inactive-text="禁用"
              inline-prompt
              @change="value => toggle(s.row, value)"
            />
            <template v-else>{{
              field.options
                ? optionLabel(s.row[field.key], field.options)
                : field.key === "carrierId"
                  ? carriers.find(c => c.id === s.row.carrierId)?.name || "-"
                  : displayField(s.row, field.key)
            }}</template></template
          ></el-table-column
        >
        <el-table-column v-if="kind === 'drivers'" label="微信" min-width="180"
          ><template #default="s"
            ><el-avatar
              v-if="s.row.wechatAvatarUrl"
              :src="s.row.wechatAvatarUrl"
              :size="28"
            />
            {{ s.row.wechatNickname || "未绑定"
            }}<el-tag
              v-if="s.row.wechatOpenid"
              :type="s.row.wechatSubscribed ? 'success' : 'info'"
              >{{ s.row.wechatSubscribed ? "已关注" : "未关注" }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column
          v-if="kind === 'logisticNode'"
          label="详细地址"
          min-width="240"
          ><template #default="s"
            ><el-tooltip
              v-if="addressText(s.row)"
              placement="top"
              :show-after="200"
            >
              <template #content>
                <div>省市区：{{ addressRegion(s.row) || "-" }}</div>
                <div>
                  详细地址：{{ s.row.address?.formattedAddress || "-" }}
                </div>
              </template>
              <span class="address-cell">{{ addressText(s.row) }}</span>
            </el-tooltip>
            <span v-else>-</span></template
          ></el-table-column
        >
        <el-table-column
          v-if="kind === 'logisticNode'"
          label="经纬度"
          min-width="180"
          ><template #default="s">{{
            s.row.longitude != null && s.row.latitude != null
              ? `${Number(s.row.longitude).toFixed(6)}, ${Number(
                  s.row.latitude
                ).toFixed(6)}`
              : "-"
          }}</template></el-table-column
        >
        <el-table-column
          v-if="kind === 'logisticNode'"
          label="城市编码"
          min-width="100"
          ><template #default="s">{{
            s.row.cityIp ?? "-"
          }}</template></el-table-column
        >
        <el-table-column
          label="操作"
          fixed="right"
          class-name="fleet-actions"
          :width="
            kind === 'drivers'
              ? hasPerms('tms:driver:sensitive:view')
                ? 260
                : 190
              : 140
          "
          ><template #default="s"
            ><el-button link type="primary" @click="edit(s.row)">编辑</el-button
            ><template v-if="kind === 'drivers'"
              ><el-button
                v-if="hasPerms('tms:driver:sensitive:view')"
                link
                type="primary"
                @click="
                  sensitiveDriver = s.row;
                  sensitiveOpen = true;
                "
                >查看原文</el-button
              ><el-button
                link
                type="primary"
                @click="
                  binding = s.row;
                  bindOpen = true;
                "
                >微信绑定</el-button
              ></template
            ><el-popconfirm
              :title="`确认删除该${def.title}？`"
              @confirm="remove(s.row)"
              ><template #reference
                ><el-button link type="danger">删除</el-button></template
              ></el-popconfirm
            ></template
          ></el-table-column
        > </el-table
      ><el-pagination
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        class="mt-4 justify-end"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @change="load().catch(report)"
    /></el-card>
    <FleetEditDialog
      v-model="editOpen"
      :kind="kind"
      :editing="editing"
      :carriers="carriers"
      @saved="load().catch(report)"
    />
    <DriverBindDialog
      v-model="bindOpen"
      :driver="binding"
      @changed="load().catch(report)"
    />
    <DriverSensitiveDialog v-model="sensitiveOpen" :driver="sensitiveDriver" />
  </div>
</template>

<style scoped>
:deep(.fleet-actions .cell) {
  display: flex;
  gap: 12px;
  align-items: center;
  white-space: nowrap;
}

:deep(.fleet-actions .el-button + .el-button) {
  margin-left: 0;
}

:deep(.driver-cell .cell) {
  white-space: nowrap;
}

.address-cell {
  display: inline-block;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}
</style>
