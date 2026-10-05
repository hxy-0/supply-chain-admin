<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import Sortable from "sortablejs";
import { pmsRequest, type Attribute, type AttributeValue } from "@/api/pms";
import type { PageResult } from "@/api/tms";
import { errorMessage } from "../composables/usePmsPage";

interface ValueRow extends Omit<AttributeValue, "attributeValueId"> {
  attributeValueId?: AttributeValue["attributeValueId"];
  key: string;
  errors: Partial<Record<"valueCode" | "valueName", string>>;
}
const visible = defineModel<boolean>({ required: true });
const props = defineProps<{ attribute?: Attribute }>();
const emit = defineEmits<{ changed: [] }>();
const keyword = ref("");
const rows = ref<ValueRow[]>([]);
const baseline = ref<Record<string, string>>({});
const loading = ref(false);
const saving = ref(false);
const failure = ref("");
const tableHost = ref<HTMLElement>();
let sortable: Sortable | undefined;
let request = 0;
let nextKey = 0;
const filteredRows = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return rows.value.filter(row =>
    `${row.valueCode} ${row.valueName}`.toLowerCase().includes(query)
  );
});
function payload(row: ValueRow, index: number) {
  return {
    attributeValueId: row.attributeValueId,
    attributeId: row.attributeId,
    valueCode: row.valueCode.trim(),
    valueName: row.valueName.trim(),
    isEnable: row.isEnable,
    sortOrder: index + 1
  };
}
const dirty = computed(() =>
  rows.value.some(
    (row, index) =>
      baseline.value[row.key] !== JSON.stringify(payload(row, index))
  )
);
const invalid = computed(() =>
  rows.value.some(
    row =>
      !!validationError(row, "valueCode") || !!validationError(row, "valueName")
  )
);
function validationError(row: ValueRow, field: "valueCode" | "valueName") {
  const value = row[field].trim();
  const label = field === "valueCode" ? "编码" : "名称";
  if (!value) return `请输入${label}`;
  if (value.length > (field === "valueCode" ? 64 : 128)) return `${label}过长`;
  if (
    field === "valueCode" &&
    rows.value.some(
      other =>
        other.key !== row.key &&
        other.valueCode.trim().toLowerCase() === value.toLowerCase()
    )
  )
    return "属性值编码不能重复";
  return "";
}
function validate(row: ValueRow, field: "valueCode" | "valueName") {
  row[field] = row[field].trim();
  row.errors[field] = validationError(row, field);
  if (field === "valueCode") {
    for (const other of rows.value) {
      if (other.errors.valueCode)
        other.errors.valueCode = validationError(other, field);
    }
  }
}
async function bindDrag() {
  await nextTick();
  sortable?.destroy();
  sortable = undefined;
  const body = tableHost.value?.querySelector<HTMLElement>(
    ".el-table__body-wrapper tbody"
  );
  if (!body) return;
  sortable = Sortable.create(body, {
    handle: ".value-drag-handle",
    animation: 150,
    disabled: loading.value || saving.value || !!keyword.value.trim(),
    onEnd(event) {
      const { oldIndex, newIndex, item, from } = event;
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
      // Restore DOM order before Vue applies the reordered data.
      from.removeChild(item);
      from.insertBefore(item, from.children[oldIndex] ?? null);
      const [moved] = rows.value.splice(oldIndex, 1);
      rows.value.splice(newIndex, 0, moved);
    }
  });
}
watch([loading, saving, keyword], () => {
  sortable?.option(
    "disabled",
    loading.value || saving.value || !!keyword.value.trim()
  );
});
watch(visible, async value => {
  const current = ++request;
  sortable?.destroy();
  sortable = undefined;
  if (!value || !props.attribute) return;
  keyword.value = "";
  rows.value = [];
  baseline.value = {};
  failure.value = "";
  loading.value = true;
  const attributeId = props.attribute.attributeId;
  try {
    const values: AttributeValue[] = [];
    for (let pageNum = 1; ; pageNum++) {
      const page = await pmsRequest<PageResult<AttributeValue>>(
        "get",
        `/attributes/${attributeId}/values/page`,
        undefined,
        { pageNum, pageSize: 100 }
      );
      if (current !== request) return;
      values.push(...page.records);
      if (!page.records.length || values.length >= Number(page.total)) break;
    }
    values.sort(
      (left, right) =>
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
        String(left.attributeValueId).localeCompare(
          String(right.attributeValueId),
          "en",
          { numeric: true }
        )
    );
    rows.value = values.map(value => ({
      ...value,
      key: `saved-${value.attributeValueId}`,
      errors: {}
    }));
    rows.value.forEach((row, index) => {
      baseline.value[row.key] = JSON.stringify(payload(row, index));
    });
  } catch (error) {
    if (current === request) failure.value = errorMessage(error);
  } finally {
    if (current === request) {
      loading.value = false;
      await bindDrag();
    }
  }
});
onBeforeUnmount(() => {
  request++;
  sortable?.destroy();
});
async function add() {
  keyword.value = "";
  rows.value.push({
    key: `new-${++nextKey}`,
    attributeId: props.attribute!.attributeId,
    valueCode: "",
    valueName: "",
    isEnable: 1,
    sortOrder: rows.value.length + 1,
    errors: {}
  });
  await nextTick();
  const inputs =
    tableHost.value?.querySelectorAll<HTMLInputElement>(".value-code input");
  inputs?.[inputs.length - 1]?.focus();
  await bindDrag();
}
async function save() {
  for (const row of rows.value) {
    validate(row, "valueCode");
    validate(row, "valueName");
  }
  if (invalid.value) {
    keyword.value = "";
    ElMessage.warning("请先修正属性值的校验错误");
    return;
  }
  saving.value = true;
  try {
    await pmsRequest(
      "post",
      `/attributes/${props.attribute!.attributeId}/values/batch`,
      {
        items: rows.value.map((row, index) => payload(row, index))
      }
    );
    emit("changed");
    ElMessage.success("保存成功");
    visible.value = false;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}
async function remove(row: ValueRow) {
  if (row.attributeValueId) {
    try {
      await ElMessageBox.confirm(
        `删除「${row.valueName}」？已被商品引用的值不能删除。`,
        "删除属性值",
        { type: "warning" }
      );
    } catch {
      return;
    }
    saving.value = true;
    try {
      await pmsRequest("delete", `/attributes/values/${row.attributeValueId}`);
      emit("changed");
    } catch (error) {
      ElMessage.error(errorMessage(error));
      return;
    } finally {
      saving.value = false;
    }
  }
  const index = rows.value.findIndex(item => item.key === row.key);
  if (index !== -1) rows.value.splice(index, 1);
  delete baseline.value[row.key];
  for (const other of rows.value) {
    if (other.errors.valueCode) validate(other, "valueCode");
  }
}
async function close(done: () => void) {
  if (saving.value) return;
  if (dirty.value) {
    try {
      await ElMessageBox.confirm(
        "属性值或顺序尚未保存，确认放弃修改？",
        "未保存的修改",
        { type: "warning" }
      );
    } catch {
      return;
    }
  }
  done();
}
</script>
<template>
  <el-drawer
    v-model="visible"
    :title="`${attribute?.name || ''} · 属性值`"
    size="min(900px,96vw)"
    append-to-body
    destroy-on-close
    :before-close="close"
    :show-close="!saving"
    :close-on-press-escape="!saving"
    :close-on-click-modal="false"
  >
    <div class="value-toolbar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索编码 / 名称"
        :disabled="loading || saving"
      />
      <el-button
        type="primary"
        :disabled="loading || saving || !!failure"
        @click="add"
        >新增属性值</el-button
      >
    </div>
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
    <div ref="tableHost">
      <el-table v-loading="loading" :data="filteredRows" row-key="key">
        <el-table-column label="序号" width="70">
          <template #default="{ row }">
            {{ rows.findIndex(item => item.key === row.key) + 1 }}
          </template>
        </el-table-column>
        <el-table-column width="44">
          <template #default>
            <button
              class="value-drag-handle"
              type="button"
              aria-label="拖拽调整顺序"
              :disabled="loading || saving || !!keyword.trim()"
            >
              ⠿
            </button>
          </template>
        </el-table-column>
        <el-table-column label="编码" min-width="220">
          <template #default="{ row }">
            <el-input
              v-model="row.valueCode"
              class="value-code"
              aria-label="属性值编码"
              maxlength="64"
              :disabled="saving"
              :class="{ 'is-invalid': row.errors.valueCode }"
              @blur="validate(row as ValueRow, 'valueCode')"
            />
            <div v-if="row.errors.valueCode" class="value-error" role="alert">
              {{ row.errors.valueCode }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="200">
          <template #default="{ row }">
            <el-input
              v-model="row.valueName"
              aria-label="属性值名称"
              maxlength="128"
              :disabled="saving"
              :class="{ 'is-invalid': row.errors.valueName }"
              @blur="validate(row as ValueRow, 'valueName')"
            />
            <div v-if="row.errors.valueName" class="value-error" role="alert">
              {{ row.errors.valueName }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-switch
              v-model="row.isEnable"
              :active-value="1"
              :inactive-value="0"
              :disabled="saving"
              aria-label="启用属性值"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button
              link
              type="danger"
              :disabled="saving"
              @mousedown.prevent
              @click="remove(row as ValueRow)"
            >
              {{ row.attributeValueId ? "删除" : "移除" }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
    <template #footer>
      <el-button :disabled="saving" @click="close(() => (visible = false))"
        >关闭</el-button
      >
      <el-button
        type="primary"
        :loading="saving"
        :disabled="loading || !!failure || invalid || !dirty"
        @click="save"
        >保存</el-button
      >
    </template>
  </el-drawer>
</template>
<style scoped>
.value-toolbar {
  display: flex;
  gap: 12px;
}

.value-toolbar .el-input {
  max-width: 320px;
}

.value-drag-handle {
  font-size: 24px;
  color: var(--el-text-color-secondary);
  cursor: grab;
  background: transparent;
  border: 0;
}

.value-drag-handle:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.value-error {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-color-danger);
}

.is-invalid :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}
</style>
