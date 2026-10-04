<script setup lang="ts">
import { ref, watch } from "vue";
import { driverApi } from "@/api/tms";
import { message } from "@/utils/message";
import BusinessDialog from "@/components/Tms/BusinessDialog.vue";
const open = defineModel<boolean>({ required: true });
const props = defineProps<{ driver?: Record<string, any> }>();
const data = ref<{ phone?: string; idCard?: string; driverLicense?: string }>();
const loading = ref(false);
let version = 0;
watch(open, async value => {
  const request = ++version;
  data.value = undefined;
  loading.value = false;
  if (!value || !props.driver?.id) return;
  loading.value = true;
  try {
    const result = await driverApi.sensitive(props.driver.id);
    if (request === version && open.value) data.value = result;
  } catch (error) {
    if (request === version) {
      message(String(error), { type: "error" });
      open.value = false;
    }
  } finally {
    if (request === version) loading.value = false;
  }
});
</script>
<template>
  <BusinessDialog
    v-model="open"
    :title="`${driver?.name || '司机'} · 敏感信息`"
    width="520px"
    readonly
  >
    <div v-loading="loading">
      <el-descriptions v-if="data" :column="1" border>
        <el-descriptions-item label="手机号">{{
          data.phone || "-"
        }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{
          data.idCard || "-"
        }}</el-descriptions-item>
        <el-descriptions-item label="驾驶证号">{{
          data.driverLicense || "-"
        }}</el-descriptions-item>
      </el-descriptions>
    </div>
  </BusinessDialog>
</template>
