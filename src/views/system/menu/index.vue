<script setup lang="ts">
import { computed, ref } from "vue";
import { ElMessage } from "element-plus";
import type Node from "element-plus/es/components/tree/src/model/node";
import { getMenuList, reorderSystemMenus } from "@/api/system";
import { getAsyncRoutes } from "@/api/routes";
import { handleTree } from "@/utils/tree";
import { cloneDeep } from "@pureadmin/utils";
import { usePermissionStoreHook } from "@/store/modules/permission";
import {
  canDrop,
  changedOrders,
  isHome,
  siblingOrders,
  type OrderedMenu
} from "./utils/ordering";
import { useMenu } from "./utils/hook";
import { transformI18n } from "@/plugins/i18n";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

import Delete from "~icons/ep/delete";
import EditPen from "~icons/ep/edit-pen";
import Refresh from "~icons/ep/refresh";
import AddFill from "~icons/ri/add-circle-line";

defineOptions({
  name: "SystemMenu"
});

const formRef = ref();
const tableRef = ref();
const {
  getMenuType,
  form,
  loading,
  columns,
  dataList,
  onSearch,
  resetForm,
  openDialog,
  handleDelete,
  handleSelectionChange
} = useMenu();

function onFullscreen() {
  // 重置表格高度
  tableRef.value.setAdaptive();
}

const orderVisible = ref(false);
const orderLoading = ref(false);
const orderSaving = ref(false);
const orderTree = ref<OrderedMenu[]>([]);
const initialOrders = ref(new Map<number, number[]>());
const pendingOrders = computed(() =>
  changedOrders(orderTree.value, initialOrders.value)
);

async function openOrder() {
  orderLoading.value = true;
  try {
    const { data } = await getMenuList();
    orderTree.value = handleTree(cloneDeep(data.filter(menu => menu.id > 0)));
    initialOrders.value = siblingOrders(orderTree.value);
    orderVisible.value = true;
  } catch {
    // The API helper displays loading failures.
  } finally {
    orderLoading.value = false;
  }
}

function allowDrag(node: Node) {
  return !orderSaving.value && !isHome(node.data as OrderedMenu);
}

function allowDrop(dragged: Node, target: Node, type: string) {
  return (
    !orderSaving.value &&
    canDrop(dragged.data as OrderedMenu, target.data as OrderedMenu, type)
  );
}

async function saveOrder() {
  if (orderSaving.value || !pendingOrders.value.length) return;
  orderSaving.value = true;
  try {
    await reorderSystemMenus(pendingOrders.value);
    initialOrders.value = siblingOrders(orderTree.value);
    orderVisible.value = false;
    ElMessage.success("菜单顺序已保存");
    await onSearch();
    try {
      const { code, data } = await getAsyncRoutes();
      if (code !== 0) throw new Error("菜单刷新失败");
      usePermissionStoreHook().handleWholeMenus(data);
    } catch {
      ElMessage.warning("顺序已保存，侧栏刷新失败，请刷新页面查看");
    }
  } catch {
    // The API helper displays the server error; retain the draft for review.
  } finally {
    orderSaving.value = false;
  }
}
</script>

<template>
  <div class="main">
    <el-form
      ref="formRef"
      :inline="true"
      :model="form"
      class="search-form bg-bg_color w-full pl-8 pt-3 overflow-auto"
    >
      <el-form-item label="菜单名称：" prop="title">
        <el-input
          v-model="form.title"
          placeholder="请输入菜单名称"
          clearable
          class="w-45!"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/search-line')"
          :loading="loading"
          @click="onSearch"
        >
          搜索
        </el-button>
        <el-button :icon="useRenderIcon(Refresh)" @click="resetForm(formRef)">
          重置
        </el-button>
      </el-form-item>
    </el-form>

    <PureTableBar
      title="菜单管理"
      :columns="columns"
      :isExpandAll="false"
      :tableRef="tableRef?.getTableRef()"
      @refresh="onSearch"
      @fullscreen="onFullscreen"
    >
      <template #buttons>
        <el-button :loading="orderLoading" @click="openOrder"
          >调整顺序</el-button
        >
        <el-button
          type="primary"
          :icon="useRenderIcon(AddFill)"
          @click="openDialog()"
        >
          新增菜单
        </el-button>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          ref="tableRef"
          adaptive
          :adaptiveConfig="{ offsetBottom: 45 }"
          align-whole="center"
          row-key="id"
          showOverflowTooltip
          table-layout="auto"
          :loading="loading"
          :size="size"
          :data="dataList"
          :columns="dynamicColumns"
          :header-cell-style="{
            background: 'var(--el-fill-color-light)',
            color: 'var(--el-text-color-primary)'
          }"
          @selection-change="handleSelectionChange"
        >
          <template #title="{ row }"
            ><span class="inline-block mr-1"
              ><component
                :is="useRenderIcon(row.icon)"
                style="padding-top: 1px" /></span
            ><span>{{ transformI18n(row.title) }}</span></template
          ><template #menuType="{ row }"
            ><el-tag
              :size="size"
              :type="getMenuType(row.menuType) as any"
              effect="plain"
              >{{ getMenuType(row.menuType, true) }}</el-tag
            ></template
          >
          <template #operation="{ row }">
            <el-button
              class="reset-margin"
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon(EditPen)"
              @click="openDialog('修改', row)"
            >
              修改
            </el-button>
            <el-button
              v-show="row.menuType !== 3"
              class="reset-margin"
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon(AddFill)"
              @click="openDialog('新增', { parentId: row.id } as any)"
            >
              新增
            </el-button>
            <el-popconfirm
              :title="`是否确认删除菜单名称为${transformI18n(row.title)}的这条数据${row?.children?.length > 0 ? '。注意下级菜单也会一并删除，请谨慎操作' : ''}`"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  class="reset-margin"
                  link
                  type="primary"
                  :size="size"
                  :icon="useRenderIcon(Delete)"
                >
                  删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </pure-table>
      </template>
    </PureTableBar>
    <el-dialog
      v-model="orderVisible"
      title="拖拽调整菜单顺序"
      width="min(680px, 92vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!orderSaving"
      :show-close="!orderSaving"
      destroy-on-close
    >
      <el-alert
        title="拖动同级菜单调整顺序，展开目录可调整子菜单。首页固定在首位，按钮权限不参与排序。"
        type="info"
        :closable="false"
      />
      <el-tree
        class="order-tree"
        :data="orderTree"
        node-key="id"
        draggable
        :allow-drag="allowDrag"
        :allow-drop="allowDrop"
        :props="{ label: 'title', children: 'children' }"
        :expand-on-click-node="false"
        :indent="24"
      >
        <template #default="{ data }">
          <span class="order-node">
            <span class="drag-handle" aria-hidden="true">⠿</span>
            <span>{{ transformI18n(data.title) }}</span>
            <el-tag v-if="isHome(data)" size="small" type="info">固定</el-tag>
          </span>
        </template>
      </el-tree>
      <template #footer>
        <el-button :disabled="orderSaving" @click="orderVisible = false"
          >取消</el-button
        >
        <el-button
          type="primary"
          :loading="orderSaving"
          :disabled="!pendingOrders.length"
          @click="saveOrder"
          >保存顺序</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.order-tree {
  max-height: 55vh;
  margin-top: 16px;
  overflow: auto;

  :deep(.el-tree-node__content) {
    height: 38px;
  }
}

.order-node {
  display: flex;
  gap: 10px;
  align-items: center;
}

.drag-handle {
  color: var(--el-text-color-secondary);
  cursor: grab;
}

:deep(.el-table__inner-wrapper::before) {
  height: 0;
}

.main-content {
  margin: 24px 24px 0 !important;
}

.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
