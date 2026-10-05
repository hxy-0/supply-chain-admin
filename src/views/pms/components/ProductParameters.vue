<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import {
  getAttributeValues,
  type Attribute,
  type AttributeValue,
  type CategoryAttribute,
  type Id,
  type ProductAttribute
} from "@/api/pms";
import { errorMessage } from "../composables/usePmsPage";
const model = defineModel<ProductAttribute[]>({ required: true });
const props = defineProps<{
  options: (Attribute | CategoryAttribute)[];
  disabled?: boolean;
}>();
const values = reactive<Record<string, AttributeValue[]>>({});
const failure = ref("");
let request = 0;
watch(
  () => props.options,
  async options => {
    const current = ++request;
    failure.value = "";
    try {
      const result = await Promise.all(
        options
          .filter(a => a.inputType !== 3)
          .map(
            async a =>
              [
                String(a.attributeId),
                await getAttributeValues(a.attributeId)
              ] as const
          )
      );
      if (current === request)
        for (const [id, list] of result) values[id] = list;
    } catch (error) {
      if (current === request) failure.value = errorMessage(error);
    }
  },
  { immediate: true }
);
function selection(attribute: Attribute): Id[] {
  return model.value
    .filter(
      item =>
        String(item.attributeId) === String(attribute.attributeId) &&
        item.attributeValueId != null
    )
    .map(item => item.attributeValueId!);
}
function update(attribute: Attribute, selected: Id | Id[] | undefined) {
  const ids = Array.isArray(selected)
    ? selected
    : selected === undefined
      ? []
      : [selected];
  model.value = [
    ...model.value.filter(
      item => String(item.attributeId) !== String(attribute.attributeId)
    ),
    ...ids.map(id => ({
      attributeId: attribute.attributeId,
      attributeValueId: id
    }))
  ];
}
function custom(attribute: Attribute) {
  return (
    model.value.find(
      item => String(item.attributeId) === String(attribute.attributeId)
    )?.customValue || ""
  );
}
function updateCustom(attribute: Attribute, value: string) {
  model.value = [
    ...model.value.filter(
      item => String(item.attributeId) !== String(attribute.attributeId)
    ),
    ...(value.trim()
      ? [{ attributeId: attribute.attributeId, customValue: value }]
      : [])
  ];
}
</script>
<template>
  <div>
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
    <el-empty
      v-if="!options.length"
      description="当前分类未配置普通参数"
      :image-size="50"
    />
    <el-form-item
      v-for="attribute in options"
      :key="attribute.attributeId"
      :label="
        attribute.name + (attribute.unit ? ' (' + attribute.unit + ')' : '')
      "
      :required="'required' in attribute && attribute.required"
    >
      <el-input
        v-if="attribute.inputType === 3"
        :model-value="custom(attribute)"
        maxlength="1000"
        :disabled="disabled"
        @update:model-value="updateCustom(attribute, $event)"
      />
      <el-select
        v-else
        :model-value="
          attribute.inputType === 2
            ? selection(attribute)
            : selection(attribute)[0]
        "
        :multiple="attribute.inputType === 2"
        clearable
        filterable
        :disabled="disabled"
        style="width: 100%"
        @update:model-value="update(attribute, $event)"
        ><el-option
          v-for="value in values[String(attribute.attributeId)] || []"
          :key="value.attributeValueId"
          :value="value.attributeValueId"
          :label="value.valueName"
          :disabled="value.isEnable !== 1"
      /></el-select>
    </el-form-item>
  </div>
</template>
