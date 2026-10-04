<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox, type FormInstance } from "element-plus";
import { getCategories, pmsRequest, type Category, type Id } from "@/api/pms";
import { categoryOptions } from "../category-options";
import CategoryAttributeEditor from "../components/CategoryAttributeEditor.vue";
defineOptions({ name: "PmsCategories" });
const templateVisible = ref(false);
const templateCategory = ref<Category>();
function configure(row: Category) {
  templateCategory.value = row;
  templateVisible.value = true;
}
function isLeaf(row: Category) {
  return !items.value.some(
    item => String(item.parentCid) === String(row.catId)
  );
}
interface CategoryNode extends Category {
  children?: CategoryNode[];
}
const items = ref<Category[]>([]);
const loading = ref(false);
const failure = ref("");
const keyword = ref("");
const visible = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const empty = () => ({
  catId: undefined as Id | undefined,
  name: "",
  parentCid: 0 as Id,
  showStatus: 1,
  sort: 0,
  icon: "",
  productUnit: ""
});
const form = reactive(empty());
const nodes = computed(() => {
  const matches = new Set(
    items.value
      .filter(c => c.name.includes(keyword.value.trim()))
      .map(c => String(c.catId))
  );
  const map = new Map(items.value.map(c => [String(c.catId), c]));
  for (const id of [...matches]) {
    let item = map.get(id);
    const visited = new Set<string>();
    while (
      item &&
      Number(item.parentCid) !== 0 &&
      !visited.has(String(item.parentCid))
    ) {
      visited.add(String(item.parentCid));
      matches.add(String(item.parentCid));
      item = map.get(String(item.parentCid));
    }
  }
  const byId = new Map<string, CategoryNode>(
    items.value
      .filter(c => matches.has(String(c.catId)))
      .map(c => [String(c.catId), { ...c, children: [] }])
  );
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = byId.get(String(node.parentCid));
    if (parent) parent.children!.push(node);
    else roots.push(node);
  }
  return roots;
});
const parentOptions = computed(() => [
  { value: 0, label: "无（一级分类）" },
  ...categoryOptions(items.value, { maxLevel: 2, excludeId: form.catId })
]);
async function load() {
  loading.value = true;
  failure.value = "";
  try {
    items.value = await getCategories();
  } catch (e) {
    failure.value = e.message;
  } finally {
    loading.value = false;
  }
}
function edit(row?: Category, parent?: Category) {
  Object.assign(
    form,
    empty(),
    row ?? {},
    parent ? { parentCid: parent.catId } : {}
  );
  visible.value = true;
}
async function save() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    await pmsRequest("post", "/categories", form);
    visible.value = false;
    ElMessage.success("分类已保存");
    await load();
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}
async function remove(row: Category) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${row.name}」？存在子分类或商品引用时不能删除。`,
      "删除分类",
      { type: "warning" }
    );
  } catch {
    return;
  }
  try {
    await pmsRequest("delete", `/categories/${row.catId}`);
    ElMessage.success("分类已删除");
    await load();
  } catch (e) {
    ElMessage.error(e.message);
  }
}
onMounted(load);
</script>
<template>
  <div class="pms-page">
    <CategoryAttributeEditor
      v-model="templateVisible"
      :category="templateCategory"
    />
    <el-card shadow="never" class="query-card">
      <el-form inline @submit.prevent
        ><el-form-item label="分类名称"
          ><el-input
            v-model="keyword"
            clearable
            placeholder="搜索分类及父级路径" /></el-form-item
        ><el-form-item
          ><el-button @click="load">刷新</el-button></el-form-item
        ></el-form
      >
    </el-card>
    <el-card shadow="never" class="content-card">
      <div class="heading">
        <div>
          <h2>分类</h2>
          <p>三级分类树，SPU 只能关联末级分类</p>
        </div>
        <el-button type="primary" @click="edit()">新增一级分类</el-button>
      </div>

      <el-alert
        v-if="failure"
        :title="failure"
        type="error"
        :closable="false"
      />
      <el-table
        v-loading="loading"
        :data="nodes"
        row-key="catId"
        :tree-props="{ children: 'children' }"
        :default-expand-all="!!keyword"
      >
        <el-table-column
          prop="name"
          label="分类名称"
          min-width="260"
        /><el-table-column
          prop="catId"
          label="分类 ID"
          width="120"
        /><el-table-column
          prop="catLevel"
          label="层级"
          width="90"
        /><el-table-column
          prop="productUnit"
          label="商品单位"
          min-width="120"
        /><el-table-column prop="sort" label="排序" width="90" />
        <el-table-column label="状态" width="100"
          ><template #default="{ row }"
            ><el-tag :type="row.showStatus === 1 ? 'success' : 'info'">{{
              row.showStatus === 1 ? "显示" : "隐藏"
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="操作" width="320"
          ><template #default="{ row }"
            ><el-button
              v-if="isLeaf(row as Category)"
              link
              type="primary"
              @click="configure(row as Category)"
              >属性模板</el-button
            ><el-button link type="primary" @click="edit(row as Category)"
              >编辑</el-button
            ><el-button
              v-if="row.catLevel < 3"
              link
              type="primary"
              @click="edit(undefined, row as Category)"
              >添加子分类</el-button
            ><el-button link type="danger" @click="remove(row as Category)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
    </el-card>
    <el-dialog
      v-model="visible"
      :title="form.catId ? '编辑分类' : '新增分类'"
      width="min(600px,94vw)"
      destroy-on-close
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-form
        ref="formRef"
        :model="form"
        label-width="96px"
        :disabled="saving"
      >
        <el-form-item
          label="分类名称"
          prop="name"
          :rules="[
            { required: true, whitespace: true, message: '请输入分类名称' }
          ]"
          ><el-input v-model="form.name" maxlength="50"
        /></el-form-item>
        <el-form-item label="父分类"
          ><el-cascader
            v-model="form.parentCid"
            :options="parentOptions"
            :props="{ emitPath: false, checkStrictly: true }"
            filterable
            placeholder="请选择父分类"
            class="parent-select"
        /></el-form-item>
        <el-form-item label="商品单位"
          ><el-input v-model="form.productUnit" maxlength="50"
        /></el-form-item>
        <el-form-item label="图标地址"
          ><el-input v-model="form.icon" maxlength="255"
        /></el-form-item>
        <el-form-item label="排序"
          ><el-input-number v-model="form.sort" :min="0" :precision="0"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-radio-group v-model="form.showStatus"
            ><el-radio :value="1">显示</el-radio
            ><el-radio :value="0">隐藏</el-radio></el-radio-group
          ></el-form-item
        >
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="visible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
<style scoped>
.parent-select {
  width: 100%;
}

.query-card {
  margin-bottom: 16px;
}

.query-card :deep(.el-form-item) {
  margin-bottom: 0;
}

.query-card :deep(.el-form) {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 0;
}

.heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.heading h2 {
  margin: 0;
  font-size: 20px;
}

.heading p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
}
</style>
