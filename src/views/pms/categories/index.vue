<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from "vue";
import {
  ElMessage,
  ElMessageBox,
  type ElTreeV2,
  type FormInstance
} from "element-plus";
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
  return !parentIds.value.has(String(row.catId));
}
interface CategoryNode extends Category {
  treeKey: string;
  children?: CategoryNode[];
}
const items = ref<Category[]>([]);
const parentIds = computed(
  () => new Set(items.value.map(item => String(item.parentCid)))
);
const treeRef = ref<InstanceType<typeof ElTreeV2>>();
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
  isShow: 1,
  sort: 0,
  icon: "",
  productUnit: ""
});
const form = reactive(empty());
const searchTerm = computed(() => keyword.value.trim());
const nodes = computed(() => {
  const matches = new Set(
    items.value
      .filter(c => c.name.includes(searchTerm.value))
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
      .map(c => [
        String(c.catId),
        { ...c, treeKey: String(c.catId), children: [] }
      ])
  );
  const roots: CategoryNode[] = [];
  for (const node of byId.values()) {
    const parent = byId.get(String(node.parentCid));
    if (parent) parent.children!.push(node);
    else roots.push(node);
  }
  function sortBranches(branches: CategoryNode[]) {
    branches.sort(
      (left, right) =>
        (left.sort ?? 0) - (right.sort ?? 0) ||
        left.treeKey.localeCompare(right.treeKey, "en", { numeric: true })
    );
    for (const branch of branches) {
      if (branch.children?.length) sortBranches(branch.children);
    }
  }
  sortBranches(roots);
  return roots;
});
watch([nodes, searchTerm], async ([roots, query], [, previousQuery]) => {
  await nextTick();
  if (query) {
    const expandedKeys: string[] = [];
    function collect(branches: CategoryNode[]) {
      for (const branch of branches) {
        if (branch.children?.length) {
          expandedKeys.push(branch.treeKey);
          collect(branch.children);
        }
      }
    }
    collect(roots);
    treeRef.value?.setExpandedKeys(expandedKeys);
    treeRef.value?.scrollTo(0);
  } else if (previousQuery) {
    treeRef.value?.setExpandedKeys([]);
    treeRef.value?.scrollTo(0);
  }
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
    if (!form.catId) {
      form.sort =
        items.value.reduce(
          (maximum, item) =>
            String(item.parentCid) === String(form.parentCid)
              ? Math.max(maximum, item.sort ?? 0)
              : maximum,
          -1
        ) + 1;
    }
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
        <p>三级分类树，SPU 只能关联末级分类</p>
        <el-button type="primary" @click="edit()">新增一级分类</el-button>
      </div>

      <el-alert
        v-if="failure"
        :title="failure"
        type="error"
        :closable="false"
      />
      <div v-loading="loading" class="category-tree-scroll">
        <div class="category-tree-table">
          <div class="category-columns category-header">
            <span>分类名称</span>
            <span>分类 ID</span>
            <span>层级</span>
            <span>商品单位</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          <el-tree-v2
            ref="treeRef"
            :data="nodes"
            :props="{ value: 'treeKey', label: 'name', children: 'children' }"
            :height="528"
            :item-size="44"
            :indent="16"
            :expand-on-click-node="false"
            :perf-mode="false"
            class="category-tree"
          >
            <template #default="{ data }">
              <div class="category-columns category-row">
                <span class="category-name" :title="data.name">{{
                  data.name
                }}</span>
                <span>{{ data.catId }}</span>
                <span>{{ data.catLevel }}</span>
                <span>{{ data.productUnit }}</span>
                <span>
                  <el-tag :type="data.isShow === 1 ? 'success' : 'info'">
                    {{ data.isShow === 1 ? "显示" : "隐藏" }}
                  </el-tag>
                </span>
                <div class="category-actions" @click.stop>
                  <el-button
                    v-if="isLeaf(data as Category)"
                    link
                    type="primary"
                    @click="configure(data as Category)"
                    >销售属性</el-button
                  >
                  <el-button
                    link
                    type="primary"
                    @click="edit(data as Category)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    v-if="data.catLevel < 3"
                    link
                    type="primary"
                    @click="edit(undefined, data as Category)"
                    >添加子分类</el-button
                  >
                  <el-button
                    link
                    type="danger"
                    @click="remove(data as Category)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </template>
            <template #empty>
              <el-empty
                :description="loading ? '正在加载分类' : '暂无匹配分类'"
              />
            </template>
          </el-tree-v2>
        </div>
      </div>
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
        <el-form-item label="状态"
          ><el-radio-group v-model="form.isShow"
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
.category-tree-scroll {
  overflow-x: auto;
}

.category-tree-table {
  min-width: 990px;
}

.category-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 90px 120px 100px 320px;
  align-items: center;
}

.category-header {
  height: 44px;
  padding-right: 8px;
  padding-left: 26px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.category-row {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding-right: 8px;
  font-size: 14px;
}

.category-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-actions {
  display: flex;
  align-items: center;
}

.category-tree :deep(.el-tree-node__content) {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

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

.heading p {
  margin: 0;
  color: var(--el-text-color-secondary);
}
</style>
