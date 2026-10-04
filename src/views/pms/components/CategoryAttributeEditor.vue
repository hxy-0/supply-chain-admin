<script setup lang="ts">
import { ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  getEnabledAttributes,
  getCategoryAttributes,
  saveCategoryAttributes,
  type Attribute,
  type Category,
  type CategoryAttribute
} from "@/api/pms";
import { errorMessage } from "../composables/usePmsPage";
const visible = defineModel<boolean>({ required: true });
const props = defineProps<{ category?: Category }>();
const items = ref<CategoryAttribute[]>([]);
const expectedItems = ref<CategoryAttribute[]>([]);
const options = ref<Attribute[]>([]);
const loading = ref(false);
const saving = ref(false);
const failure = ref("");
let request = 0;
watch(visible, async value => {
  const current = ++request;
  if (!value || !props.category) return;
  loading.value = true;
  failure.value = "";
  items.value = [];
  try {
    const [template, attributes] = await Promise.all([
      getCategoryAttributes(props.category.catId),
      getEnabledAttributes()
    ]);
    if (current !== request) return;
    expectedItems.value = template.map(item => ({ ...item }));
    items.value = template;
    options.value = attributes;
  } catch (error) {
    if (current === request) failure.value = errorMessage(error);
  } finally {
    if (current === request) loading.value = false;
  }
});
function add() {
  items.value.push({
    attributeId: "",
    attributeCode: "",
    name: "",
    inputType: 2,
    status: 1,
    attributeKind: 1,
    required: false,
    searchable: false,
    sortOrder: items.value.length
  });
}
function select(item: CategoryAttribute) {
  const attribute = options.value.find(
    a => String(a.attributeId) === String(item.attributeId)
  );
  if (attribute) {
    Object.assign(item, attribute);
    if (attribute.inputType === 3) item.attributeKind = 2;
  }
}
async function save() {
  if (items.value.some(item => !item.attributeId)) {
    ElMessage.warning("请选择每一行的属性");
    return;
  }
  if (
    new Set(items.value.map(item => String(item.attributeId))).size !==
    items.value.length
  ) {
    ElMessage.warning("不能重复选择属性");
    return;
  }
  saving.value = true;
  try {
    await saveCategoryAttributes(
      props.category!.catId,
      items.value,
      expectedItems.value
    );
    ElMessage.success("分类属性模板已保存");
    visible.value = false;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <el-drawer
    v-model="visible"
    :title="`${category?.name || ''} · 属性模板`"
    size="min(980px,96vw)"
    destroy-on-close
    :show-close="!saving"
    :close-on-press-escape="!saving"
    :close-on-click-modal="false"
  >
    <el-alert
      title="销售属性生成 SKU；普通参数描述 SPU。配置模板后，商品只能选择模板内的属性。"
      type="info"
      :closable="false"
    />
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
    <el-form :disabled="loading || saving || !!failure"
      ><el-table v-loading="loading" :data="items"
        ><el-table-column label="属性" min-width="190"
          ><template #default="{ row }"
            ><el-select
              v-model="row.attributeId"
              filterable
              @change="select(row as CategoryAttribute)"
              ><el-option
                v-if="
                  row.attributeId &&
                  !options.some(
                    a => String(a.attributeId) === String(row.attributeId)
                  )
                "
                :value="row.attributeId"
                :label="row.name + '（停用）'"
                disabled /><el-option
                v-for="attribute in options"
                :key="attribute.attributeId"
                :value="attribute.attributeId"
                :label="attribute.name"
                :disabled="
                  items.some(
                    other =>
                      other !== row &&
                      String(other.attributeId) ===
                        String(attribute.attributeId)
                  )
                " /></el-select></template></el-table-column
        ><el-table-column label="用途" width="145"
          ><template #default="{ row }"
            ><el-select v-model="row.attributeKind"
              ><el-option
                label="销售属性"
                :value="1"
                :disabled="row.inputType === 3" /><el-option
                label="普通参数"
                :value="2" /></el-select></template></el-table-column
        ><el-table-column label="必填" width="75"
          ><template #default="{ row }"
            ><el-switch v-model="row.required" /></template></el-table-column
        ><el-table-column label="可检索" width="85"
          ><template #default="{ row }"
            ><el-switch v-model="row.searchable" /></template></el-table-column
        ><el-table-column label="排序" width="130"
          ><template #default="{ row }"
            ><el-input-number
              v-model="row.sortOrder"
              :min="0"
              :precision="0"
              controls-position="right"
              style="width: 110px" /></template></el-table-column
        ><el-table-column width="70"
          ><template #default="{ $index }"
            ><el-button link type="danger" @click="items.splice($index, 1)"
              >移除</el-button
            ></template
          ></el-table-column
        ></el-table
      ><el-button @click="add">添加属性</el-button></el-form
    >
    <template #footer
      ><el-button :disabled="saving" @click="visible = false">取消</el-button
      ><el-button
        type="primary"
        :disabled="loading || !!failure"
        :loading="saving"
        @click="save"
        >保存模板</el-button
      ></template
    >
  </el-drawer>
</template>
