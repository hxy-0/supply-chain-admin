<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { ElMessage, ElMessageBox, type FormInstance } from "element-plus";
import { pmsRequest, type Attribute, type AttributeValue } from "@/api/pms";
import type { PageResult } from "@/api/tms";
import { usePmsPage, errorMessage } from "../composables/usePmsPage";
const visible = defineModel<boolean>({ required: true });
const props = defineProps<{ attribute?: Attribute }>();
const emit = defineEmits<{ changed: [] }>();
const query = reactive({ keyword: "", pageNum: 1, pageSize: 20 });
const { rows, total, loading, failure, load } = usePmsPage(() =>
  pmsRequest<PageResult<AttributeValue>>(
    "get",
    `/attributes/${props.attribute?.attributeId}/values/page`,
    undefined,
    query
  )
);
const editor = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const empty = () => ({
  attributeValueId: undefined as AttributeValue["attributeValueId"] | undefined,
  valueCode: "",
  valueName: "",
  status: 1,
  sortOrder: 0
});
const form = reactive(empty());
watch(visible, value => {
  if (value && props.attribute) {
    query.keyword = "";
    query.pageNum = 1;
    void load();
  }
});
function search() {
  query.pageNum = 1;
  void load();
}
function edit(value?: AttributeValue) {
  Object.assign(form, empty(), value ? { ...value, status: value.status } : {});
  editor.value = true;
}
async function save() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    await pmsRequest("post", "/attributes/values", {
      ...form,
      attributeId: props.attribute!.attributeId,
      valueCode: form.valueCode.trim(),
      valueName: form.valueName.trim()
    });
    editor.value = false;
    ElMessage.success("属性值已保存");
    emit("changed");
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}
async function remove(value: AttributeValue) {
  try {
    await ElMessageBox.confirm(
      `删除「${value.valueName}」？已被商品引用的值不能删除。`,
      "删除属性值",
      { type: "warning" }
    );
  } catch {
    return;
  }
  try {
    await pmsRequest("delete", `/attributes/values/${value.attributeValueId}`);
    emit("changed");
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}
</script>
<template>
  <el-drawer
    v-model="visible"
    :title="`${attribute?.name || ''} · 属性值`"
    size="min(780px,96vw)"
    append-to-body
    destroy-on-close
  >
    <el-form inline @submit.prevent="search"
      ><el-form-item
        ><el-input
          v-model="query.keyword"
          clearable
          placeholder="编码 / 名称"
          @keyup.enter="search" /></el-form-item
      ><el-button @click="search">查询</el-button
      ><el-button type="primary" @click="edit()">新增属性值</el-button></el-form
    >
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" row-key="attributeValueId"
      ><el-table-column prop="valueCode" label="编码" /><el-table-column
        prop="valueName"
        label="名称"
      /><el-table-column
        prop="sortOrder"
        label="排序"
        width="70"
      /><el-table-column label="状态" width="80"
        ><template #default="{ row }">{{
          row.status === 1 ? "启用" : "停用"
        }}</template></el-table-column
      ><el-table-column label="操作" width="130"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="edit(row as AttributeValue)"
            >编辑</el-button
          ><el-button link type="danger" @click="remove(row as AttributeValue)"
            >删除</el-button
          ></template
        ></el-table-column
      ></el-table
    >
    <el-pagination
      v-model:current-page="query.pageNum"
      v-model:page-size="query.pageSize"
      :total="total"
      layout="total, sizes, prev, pager, next"
      :page-sizes="[20, 50, 100]"
      @current-change="load"
      @size-change="search"
    />
    <el-dialog
      v-model="editor"
      title="维护属性值"
      width="min(500px,94vw)"
      append-to-body
      destroy-on-close
      :close-on-click-modal="false"
      :show-close="!saving"
      :close-on-press-escape="!saving"
    >
      <el-form ref="formRef" :model="form" label-width="80px" :disabled="saving"
        ><el-form-item
          label="编码"
          prop="valueCode"
          :rules="[{ required: true, whitespace: true, message: '请输入编码' }]"
          ><el-input v-model="form.valueCode" maxlength="64" /></el-form-item
        ><el-form-item
          label="名称"
          prop="valueName"
          :rules="[{ required: true, whitespace: true, message: '请输入名称' }]"
          ><el-input v-model="form.valueName" maxlength="128" /></el-form-item
        ><el-form-item label="排序"
          ><el-input-number
            v-model="form.sortOrder"
            :min="0"
            :precision="0" /></el-form-item
        ><el-form-item label="状态"
          ><el-radio-group v-model="form.status"
            ><el-radio :value="1">启用</el-radio
            ><el-radio :value="0">停用</el-radio></el-radio-group
          ></el-form-item
        ></el-form
      >
      <template #footer
        ><el-button :disabled="saving" @click="editor = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </el-drawer>
</template>
