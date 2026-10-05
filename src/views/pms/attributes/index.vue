<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { getAttributes, pmsRequest, type Attribute } from "@/api/pms";
import AttributeEditor from "../components/AttributeEditor.vue";
import AttributeValueManager from "../components/AttributeValueManager.vue";
import { usePmsPage, errorMessage } from "../composables/usePmsPage";
defineOptions({ name: "PmsAttributes" });
const query = reactive({
  keyword: "",
  isEnable: undefined as number | undefined,
  pageNum: 1,
  pageSize: 20
});
const { rows, total, loading, failure, load } = usePmsPage(() =>
  getAttributes(query)
);
const selected = ref<Attribute>();
const editor = ref(false);
const values = ref(false);
function search() {
  query.pageNum = 1;
  void load();
}
function edit(attribute?: Attribute) {
  selected.value = attribute;
  editor.value = true;
}
async function remove(attribute: Attribute) {
  try {
    await ElMessageBox.confirm(
      `删除「${attribute.name}」及其属性值？已有分类或商品引用时不能删除。`,
      "删除属性",
      { type: "warning" }
    );
  } catch {
    return;
  }
  try {
    await pmsRequest("delete", `/attributes/${attribute.attributeId}`);
    ElMessage.success("属性已删除");
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}
onMounted(load);
</script>
<template>
  <div class="pms-page">
    <el-card shadow="never"
      ><el-form inline @submit.prevent="search"
        ><el-form-item label="关键词"
          ><el-input
            v-model="query.keyword"
            placeholder="编码 / 名称"
            clearable
            @keyup.enter="search" /></el-form-item
        ><el-form-item label="状态"
          ><el-select
            v-model="query.isEnable"
            clearable
            placeholder="全部"
            style="width: 120px"
            ><el-option label="启用" :value="1" /><el-option
              label="停用"
              :value="0" /></el-select></el-form-item
        ><el-button type="primary" @click="search">查询</el-button
        ><el-button
          @click="
            query.keyword = '';
            query.isEnable = undefined;
            search();
          "
          >重置</el-button
        ></el-form
      ></el-card
    >
    <el-card shadow="never"
      ><div class="heading">
        <p>维护全局属性及预设值，在分类的销售属性配置中指定用途。</p>
        <el-button type="primary" @click="edit()">新增属性</el-button>
      </div>
      <el-alert
        v-if="failure"
        :title="failure"
        type="error"
        :closable="false"
      />
      <el-table v-loading="loading" :data="rows" row-key="attributeId"
        ><el-table-column
          prop="attributeCode"
          label="属性编码"
          min-width="140"
        /><el-table-column
          prop="name"
          label="属性名称"
          min-width="140"
        /><el-table-column label="输入方式" width="110"
          ><template #default="{ row }">{{
            ["", "单选", "多选", "自由输入"][row.inputType]
          }}</template></el-table-column
        ><el-table-column prop="unit" label="单位" width="90" /><el-table-column
          label="状态"
          width="90"
          ><template #default="{ row }"
            ><el-tag :type="row.isEnable === 1 ? 'success' : 'info'">{{
              row.isEnable === 1 ? "启用" : "停用"
            }}</el-tag></template
          ></el-table-column
        ><el-table-column label="操作" width="220"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="edit(row as Attribute)"
              >编辑</el-button
            ><el-button
              v-if="row.inputType !== 3"
              link
              type="primary"
              @click="
                selected = row as Attribute;
                values = true;
              "
              >属性值</el-button
            ><el-button link type="danger" @click="remove(row as Attribute)"
              >删除</el-button
            ></template
          ></el-table-column
        ></el-table
      >
      <el-pagination
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="search"
      /> </el-card
    ><AttributeEditor
      v-model="editor"
      :attribute="selected"
      @saved="load"
    /><AttributeValueManager v-model="values" :attribute="selected" />
  </div>
</template>
<style scoped>
.pms-page {
  display: grid;
  gap: 16px;
}

.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.heading p {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.el-pagination {
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
