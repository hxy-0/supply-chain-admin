<script setup lang="ts">
import { reactive, ref, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";
import { tripSheetApi, type TripStop } from "@/api/tmsExpress";
import { vehicleApi, driverApi, logisticNodeApi } from "@/api/tms";
import type { Vehicle, Driver, LogisticNode } from "@/api/tms";

const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ saved: [] }>();
const form = reactive({
  vehicleId: "",
  driverId: "",
  planDepartTime: "",
  remark: "",
  stops: [] as TripStop[]
});
const busy = shallowRef(false);
const vehicles = ref<Vehicle[]>([]);
const drivers = ref<Driver[]>([]);
const nodes = ref<LogisticNode[]>([]);
async function loadOptions() {
  try {
    vehicles.value = (
      await vehicleApi.page({ pageNum: 1, pageSize: 100 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "车辆加载失败");
  }
  try {
    drivers.value = (
      await driverApi.page({ pageNum: 1, pageSize: 100 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "司机加载失败");
  }
  try {
    nodes.value = (
      await logisticNodeApi.page({ pageNum: 1, pageSize: 200 })
    ).records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "节点加载失败");
  }
}
function addStop() {
  form.stops.push({ nodeId: "" });
}
async function save() {
  if (!form.vehicleId || !form.driverId) {
    ElMessage.error("请选择车辆和司机");
    return;
  }
  if (form.stops.some(row => !row.nodeId)) {
    ElMessage.error("停靠站点必须选择转运中心节点");
    return;
  }
  busy.value = true;
  try {
    await tripSheetApi.create({
      vehicleId: form.vehicleId,
      driverId: form.driverId,
      planDepartTime: form.planDepartTime
        ? Number(form.planDepartTime)
        : undefined,
      remark: form.remark.trim() || undefined,
      stops: form.stops.map(row => ({
        nodeId: row.nodeId,
        planArriveTime: row.planArriveTime
          ? Number(row.planArriveTime)
          : undefined,
        planDepartTime: row.planDepartTime
          ? Number(row.planDepartTime)
          : undefined,
        remark: row.remark?.trim() || undefined
      }))
    });
    visible.value = false;
    emit("saved");
    ElMessage.success("路单已创建");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "创建失败");
  } finally {
    busy.value = false;
  }
}
watch(visible, value => {
  if (value) {
    form.vehicleId = "";
    form.driverId = "";
    form.planDepartTime = "";
    form.remark = "";
    form.stops = [];
    void loadOptions();
  }
});
</script>

<template>
  <el-dialog
    v-model="visible"
    title="创建路单"
    width="720px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form label-width="100px" :disabled="busy" @submit.prevent="save">
      <el-row :gutter="12">
        <el-col :span="12"
          ><el-form-item label="车辆" required
            ><el-select v-model="form.vehicleId" filterable style="width: 100%"
              ><el-option
                v-for="vehicle in vehicles"
                :key="vehicle.id"
                :value="vehicle.id"
                :label="vehicle.plateNumber" /></el-select></el-form-item
        ></el-col>
        <el-col :span="12"
          ><el-form-item label="司机" required
            ><el-select v-model="form.driverId" filterable style="width: 100%"
              ><el-option
                v-for="driver in drivers"
                :key="driver.id"
                :value="driver.id"
                :label="driver.name" /></el-select></el-form-item
        ></el-col>
      </el-row>
      <el-form-item label="计划发车"
        ><el-date-picker
          v-model="form.planDepartTime"
          type="datetime"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="x"
      /></el-form-item>
      <el-form-item label="备注"
        ><el-input v-model="form.remark" maxlength="255"
      /></el-form-item>
      <p class="section-title">停靠站点</p>
      <el-table :data="form.stops" size="small">
        <el-table-column label="转运中心" min-width="200"
          ><template #default="{ row }"
            ><el-select v-model="row.nodeId" filterable style="width: 100%"
              ><el-option
                v-for="node in nodes"
                :key="node.id"
                :value="node.id"
                :label="node.name" /></el-select></template
        ></el-table-column>
        <el-table-column label="计划到达" width="180"
          ><template #default="{ row }"
            ><el-date-picker
              v-model="row.planArriveTime"
              type="datetime"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="x"
              aria-label="计划到达时间" /></template
        ></el-table-column>
        <el-table-column label="计划发车" width="180"
          ><template #default="{ row }"
            ><el-date-picker
              v-model="row.planDepartTime"
              type="datetime"
              format="YYYY-MM-DD HH:mm:ss"
              value-format="x"
              aria-label="计划发车时间" /></template
        ></el-table-column>
        <el-table-column width="60"
          ><template #default="{ $index }"
            ><el-button link type="danger" @click="form.stops.splice($index, 1)"
              >移除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-button class="add-stop" size="small" @click="addStop"
        >添加站点</el-button
      >
      <el-form-item class="submit-row">
        <el-button type="primary" native-type="submit">保存</el-button>
      </el-form-item>
    </el-form>
  </el-dialog>
</template>

<style scoped>
.section-title {
  padding-left: 8px;
  margin: 4px 0 12px;
  font-weight: 600;
  line-height: 1.3;
  border-left: 3px solid var(--el-color-primary);
}

.add-stop {
  margin-top: 8px;
}

.submit-row {
  margin-top: 16px;
}
</style>
