<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { message } from "@/utils/message";
import { fleetApi, type FleetKind } from "@/api/tms";

defineOptions({ name: "TmsFleet" });
const route = useRoute();
const pathKind = computed<FleetKind>(() => ({ driver: "drivers", carrier: "carriers", vehicle: "vehicles", "logistic-node": "logisticNode" })[String(route.path).split("/").pop()] as FleetKind || "drivers");
const definitions = {
  drivers: { title: "司机", search: "name", columns: [["name","姓名"],["phone","手机号"],["idCard","身份证"],["driverType","司机类型"],["status","状态"]], fields: [["name","姓名"],["phone","手机号"],["idCard","身份证"],["driverLicense","驾驶证号"]] },
  carriers: { title: "承运商", search: "name", columns: [["name","名称"],["abbrName","简称"],["unifiedSocialCreditCode","统一信用代码"],["contactPerson","联系人"],["contactPhone","联系电话"]], fields: [["name","名称"],["abbrName","简称"],["unifiedSocialCreditCode","统一信用代码"],["contactPerson","联系人"],["contactPhone","联系电话"]] },
  vehicles: { title: "车辆", search: "plateNumber", columns: [["plateNumber","车牌号"],["vehicleType","车辆类型"],["loadCapacity","载重"],["volumeCapacity","容积"],["status","状态"]], fields: [["plateNumber","车牌号"],["vehicleType","车辆类型"],["loadCapacity","载重"],["volumeCapacity","容积"]] },
  logisticNode: { title: "物流节点", search: "name", columns: [["name","名称"],["abbrName","简称"],["nodeType","节点类型"],["cityIp","城市编码"],["longitude","经度"],["latitude","纬度"]], fields: [["name","名称"],["abbrName","简称"],["nodeType","节点类型"],["cityIp","城市编码"],["longitude","经度"],["latitude","纬度"]] }
} as const;
const def = computed(() => definitions[pathKind.value]);
const records = ref<Record<string, any>[]>([]);
const total = ref(0); const loading = ref(false); const dialog = ref(false);
const query = reactive({ pageNum: 1, pageSize: 10, keyword: "" });
const form = ref<Record<string, any>>({});
async function load() { loading.value = true; try { const data: any = { pageNum: query.pageNum, pageSize: query.pageSize }; if (query.keyword) data[def.value.search] = query.keyword; const page = await fleetApi.page(pathKind.value, data); records.value = page.records || []; total.value = page.total || 0; } finally { loading.value = false; } }
function edit(row?: Record<string, any>) { form.value = row ? { ...row } : {}; dialog.value = true; }
async function save() { await fleetApi.save(pathKind.value, form.value); message("保存成功", { type: "success" }); dialog.value = false; await load(); }
async function remove(row: Record<string, any>) { await fleetApi.remove(pathKind.value, row.id); message("删除成功", { type: "success" }); await load(); }
watch(pathKind, () => { query.pageNum = 1; query.keyword = ""; load(); });
onMounted(load);
</script>
<template>
  <div>
    <el-card shadow="never" class="mb-4"><el-form inline @submit.prevent="load"><el-form-item><el-input v-model="query.keyword" :placeholder="`搜索${def.title}`" clearable/></el-form-item><el-form-item><el-button type="primary" @click="load">查询</el-button><el-button @click="query.keyword='';load()">重置</el-button><el-button type="success" @click="edit()">新增{{ def.title }}</el-button></el-form-item></el-form></el-card>
    <el-card shadow="never"><el-table :data="records" v-loading="loading"><el-table-column v-for="col in def.columns" :key="col[0]" :prop="col[0]" :label="col[1]" min-width="120"/><el-table-column label="操作" fixed="right" width="140"><template #default="s"><el-button link type="primary" @click="edit(s.row)">编辑</el-button><el-popconfirm :title="`确认删除该${def.title}？`" @confirm="remove(s.row)"><template #reference><el-button link type="danger">删除</el-button></template></el-popconfirm></template></el-table-column></el-table><el-pagination class="mt-4 justify-end" v-model:current-page="query.pageNum" v-model:page-size="query.pageSize" layout="total, prev, pager, next" :total="total" @change="load"/></el-card>
    <el-dialog v-model="dialog" :title="`${form.id?'编辑':'新增'}${def.title}`" width="600px"><el-form label-width="110px"><el-form-item v-for="field in def.fields" :key="field[0]" :label="field[1]"><el-input v-model="form[field[0]]"/></el-form-item></el-form><template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template></el-dialog>
  </div>
</template>
