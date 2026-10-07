<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import Sortable from "sortablejs";
import Rank from "~icons/ep/rank";
import type { ProductCommand } from "@/api/pms";
import { renumberSkus } from "../products/specifications";

const skus = defineModel<ProductCommand["skus"]>({ required: true });
const props = defineProps<{ disabled?: boolean }>();
const tableHost = ref<HTMLElement>();
let sortable: Sortable | undefined;
async function bindDrag() {
  await nextTick();
  sortable?.destroy();
  sortable = undefined;
  const body = tableHost.value?.querySelector<HTMLElement>(
    ".el-table__body-wrapper tbody"
  );
  if (!body) return;
  sortable = Sortable.create(body, {
    handle: ".sku-drag-handle",
    animation: 150,
    disabled: props.disabled,
    onEnd({ oldIndex, newIndex, item, from }) {
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
      from.removeChild(item);
      from.insertBefore(item, from.children[oldIndex] ?? null);
      const reordered = [...skus.value];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      skus.value = renumberSkus(reordered);
    }
  });
}
watch([tableHost, () => skus.value.length], bindDrag);
watch(
  () => props.disabled,
  disabled => sortable?.option("disabled", !!disabled)
);
onBeforeUnmount(() => sortable?.destroy());
function defaultSku(index: number) {
  skus.value.forEach((sku, i) => (sku.isDefault = i === index));
}
function remove(index: number) {
  if (props.disabled || skus.value.length <= 1) return;
  const remaining = skus.value.filter((_, i) => i !== index);
  if (!remaining.some(sku => sku.isDefault)) remaining[0].isDefault = true;
  skus.value = renumberSkus(remaining);
}
</script>
<template>
  <div ref="tableHost">
    <p class="price-help">
      保存商品后，可在 SKU 管理的“价格维护”中设置各销售地区的价格与币种。
    </p>
    <el-table :data="skus" row-key="specSignature"
      ><el-table-column label="排序" width="65"
        ><template #default
          ><span class="sku-drag-handle" title="拖动调整序号"
            ><el-icon><Rank /></el-icon></span></template
      ></el-table-column>
      <el-table-column label="序号" width="75"
        ><template #default="{ $index }">{{
          String($index + 1).padStart(3, "0")
        }}</template></el-table-column
      >
      <el-table-column
        prop="specText"
        label="规格"
        min-width="160"
      /><el-table-column label="SKU 编码" min-width="140"
        ><template #default="{ row }">{{
          row.skuCode
        }}</template></el-table-column
      ><el-table-column label="状态" width="95"
        ><template #default="{ row }"
          ><el-select v-model="row.isEnable" :disabled="disabled"
            ><el-option label="启用" :value="1" /><el-option
              label="停用"
              :value="0" /></el-select></template></el-table-column
      ><el-table-column label="默认" width="70"
        ><template #default="{ row, $index }"
          ><el-radio
            :model-value="!!row.isDefault"
            :value="true"
            :disabled="disabled"
            @change="defaultSku($index)"
            ><span /></el-radio></template></el-table-column
      ><el-table-column label="操作" width="80"
        ><template #default="{ $index }"
          ><el-button
            link
            type="danger"
            :disabled="disabled || skus.length <= 1"
            @click="remove($index)"
            >删除</el-button
          ></template
        ></el-table-column
      ></el-table
    >
  </div>
</template>
<style scoped>
.price-help {
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
}

.sku-drag-handle {
  display: inline-flex;
  font-size: 18px;
  color: var(--el-text-color-secondary);
  cursor: grab;
}
</style>
