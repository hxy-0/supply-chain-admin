<script setup lang="ts">
import { computed, ref } from "vue";
import { logisticNodeApi } from "@/api/tms";
import { message } from "@/utils/message";
import AmapView from "@/components/Tms/AmapView.vue";
import { regionOptions } from "@/components/Tms/regions";
const form = defineModel<Record<string, any>>({ required: true });
const busy = ref(false);
const region = computed({
  get: () =>
    [form.value.province, form.value.city, form.value.district].filter(Boolean),
  set: (values: string[]) =>
    Object.assign(form.value, {
      province: values?.[0],
      city: values?.[1],
      district: values?.[2]
    })
});
async function geocode() {
  if (!form.value.formattedAddress?.trim())
    return message("请输入详细地址", { type: "warning" });
  busy.value = true;
  try {
    const result = await logisticNodeApi.geocode({
      province: form.value.province || "",
      city: form.value.city || "",
      district: form.value.district || "",
      formattedAddress: form.value.formattedAddress.trim()
    });
    Object.assign(form.value, result.address, {
      longitude: result.longitude,
      latitude: result.latitude
    });
  } catch (error) {
    message(String(error), { type: "error" });
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <el-divider content-position="left">地址及地图定位</el-divider>
  <el-form-item label="行政区划"
    ><el-cascader
      v-model="region"
      :options="regionOptions"
      filterable
      clearable
      style="width: 100%"
  /></el-form-item>
  <el-form-item label="详细地址"
    ><el-input v-model="form.formattedAddress"
      ><template #append
        ><el-button :loading="busy" @click="geocode"
          >解析坐标</el-button
        ></template
      ></el-input
    ></el-form-item
  >
  <AmapView
    :points="
      form.longitude != null && form.latitude != null
        ? [
            {
              longitude: form.longitude,
              latitude: form.latitude,
              plateNumber: form.name
            }
          ]
        : []
    "
    selectable
    @select="Object.assign(form, $event)"
  />
</template>
