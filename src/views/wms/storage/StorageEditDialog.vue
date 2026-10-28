<script setup lang="ts">
import { reactive, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  storageApi,
  zoneTypes,
  locationTypes,
  type Zone,
  type Location,
  type Id
} from "@/api/wmsInventory";
const props = defineProps<{
  warehouseId?: Id;
  zone?: Zone;
  record?: Zone | Location;
  kind: "zone" | "location";
}>();
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ saved: [] }>();
const saving = shallowRef(false);
const form = reactive({ code: "", name: "", type: 0, status: 0, remark: "" });
watch(visible, open => {
  if (!open) {
    return;
  }
  const row = props.record;
  form.code = row?.code || "";
  form.name = row && "name" in row ? row.name : "";
  form.type = row ? ("zoneType" in row ? row.zoneType : row.locationType) : 0;
  form.status =
    props.kind === "zone" ? (row?.status ?? 0) : row?.status === 2 ? 2 : 0;
  form.remark = row?.remark || "";
});
async function save() {
  if (saving.value) {
    return;
  }
  if (
    !props.warehouseId ||
    !form.code.trim() ||
    (props.kind === "zone" && !form.name.trim())
  ) {
    ElMessage.error("请填写必填项");
    return;
  }
  saving.value = true;
  try {
    const common = {
      id: props.record?.id,
      warehouseId: props.warehouseId,
      code: form.code.trim(),
      status: form.status,
      remark: form.remark
    };
    if (props.kind === "zone") {
      await storageApi.saveZone({
        ...common,
        name: form.name.trim(),
        zoneType: form.type
      });
    } else {
      await storageApi.saveLocation({
        ...common,
        zoneId: props.zone?.id,
        locationType: form.type
      });
    }
    ElMessage.success("保存成功");
    visible.value = false;
    emit("saved");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <el-dialog
    v-model="visible"
    :title="`${record ? '编辑' : '新增'}${kind === 'zone' ? '库区' : '库位'}`"
    width="520px"
    :close-on-click-modal="!saving"
  >
    <el-form label-width="100px" :disabled="saving" @submit.prevent="save">
      <el-form-item label="编码" required
        ><el-input v-model="form.code" :disabled="!!record" maxlength="50"
      /></el-form-item>
      <el-form-item v-if="kind === 'zone'" label="名称" required
        ><el-input v-model="form.name" maxlength="100"
      /></el-form-item>
      <el-form-item v-else label="所属库区">{{ zone?.name }}</el-form-item>
      <el-form-item label="用途" required
        ><el-select v-model="form.type"
          ><el-option
            v-for="(name, index) in kind === 'zone' ? zoneTypes : locationTypes"
            :key="index"
            :label="name"
            :value="index" /></el-select
      ></el-form-item>
      <el-form-item label="状态"
        ><el-radio-group v-model="form.status"
          ><el-radio :value="0">启用</el-radio
          ><el-radio :value="kind === 'zone' ? 1 : 2"
            >停用</el-radio
          ></el-radio-group
        ></el-form-item
      >
      <el-form-item label="备注"
        ><el-input v-model="form.remark" type="textarea" maxlength="255"
      /></el-form-item>
      <p>所属关系及编码创建后固定；库位是否有货由实际库存计算。</p>
    </el-form>
    <template #footer
      ><el-button :disabled="saving" @click="visible = false">取消</el-button
      ><el-button type="primary" :loading="saving" @click="save"
        >保存</el-button
      ></template
    >
  </el-dialog>
</template>
