<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { FormInstance } from "element-plus";
import { carrierApi, driverApi, logisticNodeApi, vehicleApi } from "@/api/tms";
import { message } from "@/utils/message";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
import FleetFormFields from "./FleetFormFields.vue";
import DriverWechat from "./DriverWechat.vue";
import NodeAddressFields from "./NodeAddressFields.vue";
import { definitions, enumCode, type FleetKind } from "../definitions";
const props = defineProps<{
  kind: FleetKind;
  editing?: Record<string, any>;
  carriers: { id: string; name: string }[];
}>();
const open = defineModel<boolean>({ required: true });
const emit = defineEmits<{ saved: [] }>();
const form = ref<Record<string, any>>({});
const formRef = ref<FormInstance>();
const busy = ref(false);
const def = computed(() => definitions[props.kind]);
const apis = {
  drivers: driverApi,
  carriers: carrierApi,
  vehicles: vehicleApi,
  logisticNode: logisticNodeApi
};
watch(open, value => {
  if (!value) return;
  form.value = props.editing
    ? JSON.parse(JSON.stringify(props.editing))
    : { ...def.value.defaults };
  for (const field of def.value.fields)
    if (field.options)
      form.value[field.key] = enumCode(form.value[field.key], field.options);
  if (props.kind === "logisticNode")
    Object.assign(form.value, form.value.address || {}, { country: "中国" });
});
async function save() {
  if (busy.value || !(await formRef.value?.validate().catch(() => false)))
    return;
  const data = { ...form.value };
  for (const key of Object.keys(data))
    if (typeof data[key] === "string") data[key] = data[key].trim();
  if (
    props.kind === "carriers" &&
    data.cooperationStartDate &&
    data.cooperationEndDate &&
    data.cooperationEndDate < data.cooperationStartDate
  )
    return message("合作结束日期不能早于开始日期", { type: "warning" });
  if (props.kind === "logisticNode") delete data.address;
  busy.value = true;
  try {
    await apis[props.kind].save(data);
    message("保存成功", { type: "success" });
    open.value = false;
    emit("saved");
  } catch (error) {
    message(String(error), { type: "error" });
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <BusinessDialog
    v-model="open"
    :title="`${editing ? '编辑' : '新增'}${def.title}`"
    :busy="busy"
    @submit="save"
  >
    <el-form ref="formRef" :model="form" label-position="top" :disabled="busy">
      <FleetFormFields
        v-model="form"
        :fields="def.fields"
        :carriers="carriers"
      />
      <NodeAddressFields v-if="kind === 'logisticNode'" v-model="form" />
      <DriverWechat v-if="kind === 'drivers' && open" v-model="form" />
    </el-form>
  </BusinessDialog>
</template>
