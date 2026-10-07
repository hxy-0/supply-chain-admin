<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "vue";
import Sortable from "sortablejs";
import Rank from "~icons/ep/rank";
import { ElMessage } from "element-plus";
import {
  getAttributeValues,
  type Attribute,
  type AttributeValue,
  type ProductCommand,
  type CategoryAttribute
} from "@/api/pms";
import {
  orderAxisValues,
  signatures,
  skuCode,
  type Axis
} from "../products/specifications";
import { errorMessage } from "../composables/usePmsPage";
const props = defineProps<{
  options: (Attribute | CategoryAttribute)[];
  selections: ProductCommand["salesAttributes"];
  skus: ProductCommand["skus"];
  knownSkus?: ProductCommand["skus"];
  disabled?: boolean;
  productCode: string;
}>();
const emit = defineEmits<{
  generated: [
    selections: ProductCommand["salesAttributes"],
    skus: ProductCommand["skus"]
  ];
  dirty: [value: boolean];
  changed: [selections: ProductCommand["salesAttributes"]];
  loading: [value: boolean];
  recoded: [skus: ProductCommand["skus"]];
}>();
const axes = ref<Axis[]>(
  [
    ...(props.selections.length
      ? props.selections
      : props.options
          .filter(item => "attributeKind" in item)
          .map(item => ({
            attributeId: item.attributeId,
            valueIds: [],
            sortOrder: "sortOrder" in item ? item.sortOrder : 0
          })))
  ]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(item => ({
      attributeId: item.attributeId,
      valueIds: [...item.valueIds]
    }))
);
const salesGrid = ref<HTMLElement>();
const orderedFormAxes = computed(() => orderAxisValues(axes.value, values));
function combinationKey() {
  return axes.value
    .map(
      axis =>
        `${axis.attributeId}=${axis.valueIds.map(String).sort().join(",")}`
    )
    .sort()
    .join(";");
}
let currentCombinationKey = combinationKey();
let combinationsChanged = false;
let sortable: Sortable | undefined;
watch(salesGrid, async grid => {
  await nextTick();
  sortable?.destroy();
  if (!grid) return;
  sortable = Sortable.create(grid, {
    handle: ".axis-drag-handle",
    animation: 150,
    disabled: blocked.value,
    onEnd({ oldIndex, newIndex, item, from }) {
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
      from.removeChild(item);
      from.insertBefore(item, from.children[oldIndex] ?? null);
      const reordered = [...axes.value];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);
      axes.value = reordered;
    }
  });
});
onBeforeUnmount(() => {
  sortable?.destroy();
  request++;
  emit("loading", false);
});
const values = reactive<Record<string, AttributeValue[]>>({});
// 缓存按稳定组合匹配，编码和拖动序号变化不会影响 SKU 身份。
const previousSkus = new Map(
  (props.knownSkus ?? props.skus).map(sku => [sku.specSignature, { ...sku }])
);
watch(
  () => props.skus,
  skus => {
    for (const sku of skus) previousSkus.set(sku.specSignature, { ...sku });
  },
  { deep: true, flush: "sync" }
);
const codeFailure = ref("");
function recode(reorder = false) {
  if (props.disabled || loading.value || !props.skus.length) return;
  try {
    const combinations = signatures(orderedFormAxes.value);
    const available = new Set(combinations);
    if (props.skus.some(sku => !available.has(sku.specSignature))) return;
    const orderedSkus = [...props.skus];
    if (reorder) {
      const positions = new Map(
        combinations.map((signature, index) => [signature, index])
      );
      orderedSkus.sort(
        (left, right) =>
          positions.get(left.specSignature) - positions.get(right.specSignature)
      );
    }
    const updated = orderedSkus.map((sku, index) => ({
      ...sku,
      specText: orderedFormAxes.value
        .map(axis => {
          const id = String(axis.attributeId);
          const selected = new Map(
            sku.specSignature
              .split(";")
              .filter(Boolean)
              .map(pair => pair.split("=")) as [string, string][]
          );
          return `${props.options.find(attribute => String(attribute.attributeId) === id)?.name}: ${values[id]?.find(value => String(value.attributeValueId) === selected.get(id))?.valueName}`;
        })
        .join(" / "),
      skuCode: skuCode(
        props.productCode,
        sku.specSignature,
        orderedFormAxes.value,
        values,
        index
      ),
      sortOrder: index
    }));
    codeFailure.value = "";
    if (
      updated.some(
        (sku, index) =>
          sku.skuCode !== props.skus[index].skuCode ||
          sku.specText !== props.skus[index].specText ||
          sku.sortOrder !== props.skus[index].sortOrder
      )
    )
      emit("recoded", updated);
  } catch (error) {
    codeFailure.value = errorMessage(error);
  }
}
watch(
  () => props.productCode,
  () => recode()
);
watch(
  () => props.skus.map(sku => sku.specSignature).join("|"),
  () => recode()
);
const failure = ref("");
const loading = ref(false);
const blocked = computed(
  () => props.disabled || loading.value || !!failure.value
);
const combinationCount = computed(() =>
  axes.value.reduce(
    (count, axis) => count * new Set(axis.valueIds.map(String)).size,
    1
  )
);
watch(blocked, value => sortable?.option("disabled", !!value));
let request = 0;
async function loadValues() {
  const current = ++request;
  failure.value = "";
  loading.value = true;
  emit("loading", true);
  try {
    const result = await Promise.all(
      axes.value
        .filter(axis => axis.attributeId)
        .map(
          async axis =>
            [
              String(axis.attributeId),
              await getAttributeValues(axis.attributeId)
            ] as const
        )
    );
    if (current === request) for (const [id, list] of result) values[id] = list;
  } catch (error) {
    if (current === request) {
      failure.value = errorMessage(error);
      emit("dirty", true);
    }
  } finally {
    if (current === request) {
      loading.value = false;
      emit("loading", false);
      if (combinationsChanged && props.skus.length && !props.disabled) {
        try {
          signatures(axes.value);
          generate();
        } catch {
          /* 选择未完成时等待继续选择。 */
        }
      } else recode(true);
    }
  }
}
watch(
  axes,
  () => {
    emit(
      "changed",
      orderedFormAxes.value.map((axis, index) => ({
        ...axis,
        valueIds: [...axis.valueIds],
        sortOrder: index
      }))
    );
    const key = combinationKey();
    if (key !== currentCombinationKey) combinationsChanged = true;
    currentCombinationKey = key;
    if (!combinationsChanged) {
      recode(true);
      return;
    }
    emit("dirty", true);
    if (!loading.value && props.skus.length && !props.disabled) {
      try {
        signatures(axes.value);
        generate();
      } catch {
        // 尚未选全销售属性时保留当前行，待选全再生成。
      }
    }
  },
  { deep: true }
);
watch(
  () => props.options,
  () => {
    void loadValues();
  },
  { immediate: true }
);
async function select(axis: Axis) {
  axis.valueIds = [];
  await loadValues();
}
function generate() {
  try {
    const orderedAxes = orderedFormAxes.value;
    const combinations = signatures(orderedAxes);
    const previous = new Map([
      ...previousSkus,
      ...props.skus.map(sku => [sku.specSignature, sku] as const)
    ]);
    const result: ProductCommand["skus"] = combinations.map(
      (signature, index) => {
        const old = previous.get(signature);
        const selected = new Map(
          signature
            .split(";")
            .filter(Boolean)
            .map(pair => pair.split("=")) as [string, string][]
        );
        const sku = old
          ? {
              ...old,
              isEnable: props.skus.some(
                item => item.specSignature === signature
              )
                ? old.isEnable
                : 1
            }
          : {
              specSignature: signature,

              isEnable: 1,
              isDefault: index === 0,
              images: []
            };
        return {
          ...sku,
          specText: orderedAxes
            .map(axis => {
              const id = String(axis.attributeId);
              return `${props.options.find(attribute => String(attribute.attributeId) === id)?.name}: ${values[id]?.find(value => String(value.attributeValueId) === selected.get(id))?.valueName}`;
            })
            .join(" / "),
          skuCode: skuCode(
            props.productCode,
            signature,
            orderedAxes,
            values,
            index
          ),
          sortOrder: index
        };
      }
    );
    if (result.filter(sku => sku.isDefault).length !== 1)
      result.forEach((sku, index) => (sku.isDefault = index === 0));
    emit(
      "generated",
      orderedAxes.map((axis, index) => ({
        ...axis,
        valueIds: [...axis.valueIds],
        sortOrder: index
      })),
      result
    );
    emit("dirty", false);
    combinationsChanged = false;
    codeFailure.value = "";
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}
</script>
<template>
  <div>
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
    <el-alert
      v-if="codeFailure"
      :title="codeFailure"
      type="error"
      :closable="false"
    />
    <el-button v-if="failure" @click="loadValues">重新加载属性值</el-button>
    <div>
      <div ref="salesGrid" class="sales-grid">
        <div
          v-for="(axis, index) in axes"
          :key="String(axis.attributeId) || 'new-' + index"
          class="axis"
        >
          <span class="axis-drag-handle" title="拖动调整销售属性顺序"
            ><el-icon><Rank /></el-icon
          ></span>
          <el-select
            v-model="axis.attributeId"
            :disabled="blocked"
            placeholder="销售属性"
            filterable
            @change="select(axis)"
            ><el-option
              v-for="attribute in options"
              :key="attribute.attributeId"
              :value="attribute.attributeId"
              :label="
                attribute.name +
                ('required' in attribute && attribute.required
                  ? '（必填）'
                  : '')
              "
              :disabled="
                attribute.isEnable !== 1 ||
                axes.some(
                  other =>
                    other !== axis &&
                    String(other.attributeId) === String(attribute.attributeId)
                )
              " /></el-select
          ><el-select
            v-model="axis.valueIds"
            :disabled="blocked"
            multiple
            filterable
            placeholder="选择属性值"
            ><el-option
              v-for="value in values[String(axis.attributeId)] || []"
              :key="value.attributeValueId"
              :value="value.attributeValueId"
              :label="value.valueName + ' / ' + value.valueCode"
              :disabled="value.isEnable !== 1" /></el-select
          ><el-button
            v-if="!disabled"
            :disabled="blocked"
            @click="axes.splice(index, 1)"
            >移除</el-button
          >
        </div>
      </div>
      <el-button
        v-if="!disabled"
        :disabled="blocked"
        @click="axes.push({ attributeId: '', valueIds: [] })"
        >添加销售属性</el-button
      ><el-button
        v-if="!disabled"
        :disabled="blocked"
        type="primary"
        @click="generate"
        >生成SKU（{{ combinationCount }}）</el-button
      >
    </div>
  </div>
</template>
<style scoped>
.sales-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px 20px;
  margin-bottom: 12px;
}

.axis {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) minmax(0, 2fr) auto;
  gap: 8px;
  min-width: 0;
}

.axis .el-select {
  width: 100%;
  min-width: 0;
}

.axis .el-button {
  margin-left: 0;
}

.axis-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  cursor: grab;
}

@media (width <= 640px) {
  .sales-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
