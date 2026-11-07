<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from "vue";
import { ElMessage } from "element-plus";
import { storageApi, type Zone, type Id } from "@/api/wmsInventory";
import {
  shelfApi,
  slotCodes,
  type Shelf,
  type ShelfForm
} from "@/api/wmsShelf";
import type { Warehouse } from "@/api/wms";

const props = defineProps<{
  warehouses: Warehouse[];
  record?: Shelf;
}>();
const visible = defineModel<boolean>({ default: false });
const emit = defineEmits<{ saved: [] }>();
const saving = shallowRef(false);
const zones = shallowRef<Zone[]>([]);
const form = reactive({
  warehouseId: undefined as Id | undefined,
  zoneId: undefined as Id | undefined,
  code: "",
  shelfLevel: 4,
  shelfColumn: 4,
  status: 0,
  remark: ""
});
const editing = computed(() => !!props.record);
const preview = computed(() =>
  form.code.trim() &&
  Number.isInteger(form.shelfLevel) &&
  Number.isInteger(form.shelfColumn) &&
  form.shelfLevel > 0 &&
  form.shelfColumn > 0 &&
  form.shelfLevel * form.shelfColumn <= 400
    ? slotCodes(form.code.trim(), form.shelfLevel, form.shelfColumn)
    : []
);
watch(visible, open => {
  if (!open) {
    return;
  }
  const row = props.record;
  form.warehouseId = row?.warehouseId;
  form.zoneId = row?.zoneId;
  form.code = row?.code || "";
  form.shelfLevel = row?.shelfLevel || 4;
  form.shelfColumn = row?.shelfColumn || 4;
  form.status = row?.status ?? 0;
  form.remark = row?.remark || "";
  zones.value = [];
  if (form.warehouseId) {
    void loadZones(form.warehouseId);
  }
});
watch(
  () => form.warehouseId,
  warehouseId => {
    if (warehouseId && (!editing.value || !zones.value.length)) {
      form.zoneId = editing.value ? form.zoneId : undefined;
      void loadZones(warehouseId);
    }
  }
);
async function loadZones(warehouseId: Id) {
  try {
    const page = await storageApi.zones({
      warehouseId,
      pageNum: 1,
      pageSize: 200
    });
    zones.value = page.records;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "库区加载失败");
  }
}
async function save() {
  if (saving.value) {
    return;
  }
  if (!form.warehouseId || !form.zoneId || !form.code.trim()) {
    ElMessage.error("请选择仓库、库区并填写编码前缀");
    return;
  }
  saving.value = true;
  try {
    const command: ShelfForm = {
      id: props.record?.id,
      warehouseId: form.warehouseId,
      zoneId: form.zoneId,
      code: form.code.trim(),
      shelfLevel: form.shelfLevel,
      shelfColumn: form.shelfColumn,
      status: form.status,
      remark: form.remark
    };
    await shelfApi.save(command);
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
    :title="`${record ? '编辑' : '新增'}货架`"
    width="560px"
    :close-on-click-modal="!saving"
  >
    <el-form label-width="110px" :disabled="saving" @submit.prevent="save">
      <el-form-item label="所属仓库" required
        ><el-select
          v-model="form.warehouseId"
          placeholder="选择仓库"
          filterable
          :disabled="editing"
          style="width: 100%"
          ><el-option
            v-for="row in warehouses"
            :key="row.id"
            :label="`${row.name}（${row.code}）`"
            :value="row.id" /></el-select
      ></el-form-item>
      <el-form-item label="所属库区" required
        ><el-select
          v-model="form.zoneId"
          placeholder="选择库区"
          :disabled="editing || !form.warehouseId"
          style="width: 100%"
          ><el-option
            v-for="row in zones"
            :key="row.id"
            :label="`${row.name}（${row.code}）`"
            :value="row.id" /></el-select
      ></el-form-item>
      <el-form-item label="编码前缀" required
        ><el-input
          v-model="form.code"
          :disabled="editing"
          maxlength="16"
          placeholder="1-16位字母或数字，如 A1"
      /></el-form-item>
      <el-form-item label="货架规格" required
        ><el-input-number
          v-model="form.shelfLevel"
          :min="1"
          :max="20"
          :disabled="editing"
          controls-position="right"
        /><span class="shelf-spec-x">×</span
        ><el-input-number
          v-model="form.shelfColumn"
          :min="1"
          :max="20"
          :disabled="editing"
          controls-position="right"
        /><span class="shelf-spec-x">层×列</span></el-form-item
      >
      <el-form-item v-if="!editing && preview.length" label="仓位预览"
        ><div class="shelf-slot-preview">
          <span
            v-for="slotCode in preview"
            :key="slotCode"
            class="shelf-slot"
            >{{ slotCode }}</span
          >
        </div></el-form-item
      >
      <el-form-item label="状态" required
        ><el-radio-group v-model="form.status"
          ><el-radio :value="0">启用</el-radio
          ><el-radio :value="1">停用</el-radio></el-radio-group
        ></el-form-item
      >
      <el-form-item label="备注"
        ><el-input v-model="form.remark" type="textarea" maxlength="512"
      /></el-form-item>
      <p>
        所属关系、编码及规格创建后固定；停用货架会同时停用其全部仓位，启用后按真实库存恢复。
      </p>
    </el-form>
    <template #footer
      ><el-button :disabled="saving" @click="visible = false">取消</el-button
      ><el-button type="primary" :loading="saving" @click="save"
        >保存</el-button
      ></template
    >
  </el-dialog>
</template>
<style scoped>
.shelf-spec-x {
  margin: 0 8px;
}

.shelf-slot-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 160px;
  overflow: auto;
}

.shelf-slot {
  padding: 0 6px;
  font-size: 12px;
  line-height: 22px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
}
</style>
