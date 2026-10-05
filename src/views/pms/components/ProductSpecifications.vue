<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  getAttributeValues,
  type Attribute,
  type AttributeValue,
  type ProductCommand,
  type CategoryAttribute,
  type Id
} from "@/api/pms";
import { signatures, type Axis } from "../products/specifications";
import AttributeEditor from "./AttributeEditor.vue";
import AttributeValueManager from "./AttributeValueManager.vue";
import { errorMessage } from "../composables/usePmsPage";
const props = defineProps<{
  options: (Attribute | CategoryAttribute)[];
  selections: ProductCommand["salesAttributes"];
  skus: ProductCommand["skus"];
  disabled?: boolean;
}>();
const emit = defineEmits<{
  generated: [
    selections: ProductCommand["salesAttributes"],
    skus: ProductCommand["skus"]
  ];
  dirty: [value: boolean];
  refresh: [];
}>();
const axes = ref<Axis[]>(
  props.selections.map(item => ({
    attributeId: item.attributeId,
    valueIds: [...item.valueIds]
  }))
);
const values = reactive<Record<string, AttributeValue[]>>({});
const failure = ref("");
const loading = ref(false);
const blocked = computed(
  () => props.disabled || loading.value || !!failure.value
);
const attributeEditor = ref(false);
const valueEditor = ref(false);
const selectedAttribute = ref<Attribute>();
let request = 0;
async function loadValues() {
  const current = ++request;
  failure.value = "";
  loading.value = true;
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
    if (current === request) failure.value = errorMessage(error);
  } finally {
    if (current === request) loading.value = false;
  }
}
watch(axes, () => emit("dirty", true), { deep: true });
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
function manageValues(id: Id) {
  selectedAttribute.value = props.options.find(
    item => String(item.attributeId) === String(id)
  );
  valueEditor.value = true;
}
function generate() {
  try {
    const combinations = signatures(axes.value);
    const previous = new Map(props.skus.map(sku => [sku.specSignature, sku]));
    const result: ProductCommand["skus"] = combinations.map(
      (signature, index) => {
        const old = previous.get(signature);
        return old
          ? { ...old }
          : {
              specSignature: signature,
              specText: signature
                .split(";")
                .filter(Boolean)
                .map(pair => {
                  const [id, value] = pair.split("=");
                  return `${props.options.find(a => String(a.attributeId) === id)?.name}: ${values[id]?.find(v => String(v.attributeValueId) === value)?.valueName}`;
                })
                .join(" / "),
              retailPrice: 0,
              currencyCode: "CNY",
              isEnable: 1,
              isDefault: index === 0,
              images: []
            };
      }
    );
    if (result.filter(sku => sku.isDefault).length !== 1)
      result.forEach((sku, index) => (sku.isDefault = index === 0));
    emit(
      "generated",
      axes.value.map((axis, index) => ({
        ...axis,
        valueIds: [...axis.valueIds],
        sortOrder: index
      })),
      result
    );
    emit("dirty", false);
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}
</script>
<template>
  <div>
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
    <el-button v-if="failure" @click="loadValues">重新加载属性值</el-button>
    <p>选择规格值后生成 SKU。相同组合保留已填写资料，新组合需要填写零售价。</p>
    <div>
      <div v-for="(axis, index) in axes" :key="index" class="axis">
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
              ('required' in attribute && attribute.required ? '（必填）' : '')
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
            :label="value.valueName"
            :disabled="value.isEnable !== 1" /></el-select
        ><el-button
          :disabled="blocked || !axis.attributeId"
          @click="manageValues(axis.attributeId)"
          >维护值</el-button
        ><el-button :disabled="blocked" @click="axes.splice(index, 1)"
          >移除</el-button
        >
      </div>
      <el-button
        :disabled="blocked"
        @click="axes.push({ attributeId: '', valueIds: [] })"
        >添加规格</el-button
      ><el-button :disabled="blocked" @click="attributeEditor = true"
        >新增属性</el-button
      ><el-button :disabled="blocked" type="primary" @click="generate"
        >生成 SKU</el-button
      >
    </div>
    <AttributeEditor
      v-model="attributeEditor"
      @saved="emit('refresh')"
    /><AttributeValueManager
      v-model="valueEditor"
      :attribute="selectedAttribute"
      @changed="loadValues"
    />
  </div>
</template>
<style scoped>
.axis {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.axis .el-select {
  width: 220px;
}
</style>
