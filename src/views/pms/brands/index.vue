<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules
} from "element-plus";
import { pmsRequest, type Brand } from "@/api/pms";
import type { PageResult } from "@/api/tms";
import { usePmsPage } from "../composables/usePmsPage";
import BrandLogoUpload from "../components/BrandLogoUpload.vue";
defineOptions({ name: "PmsBrands" });
type BrandForm = Omit<Brand, "brandId" | "isEnable"> & {
  brandId?: string | number;
  isEnable: number;
};
const query = reactive({
  keyword: "",
  isEnable: undefined,
  pageNum: 1,
  pageSize: 10
});
const { rows, total, loading, failure, load } = usePmsPage(() =>
  pmsRequest<PageResult<Brand>>("get", "/brands", undefined, {
    ...query,
    keyword: query.keyword.trim() || undefined
  })
);
const visible = ref(false);
const saving = ref(false);
const logoUploading = ref(false);
const formRef = ref<FormInstance>();
const empty = (): BrandForm => ({
  name: "",
  englishName: "",
  logoUrl: "",
  websiteUrl: "",
  description: "",
  sortOrder: 0,
  isEnable: 1
});
const form = reactive<BrandForm>(empty());
const rules: FormRules = {
  name: [
    {
      required: true,
      whitespace: true,
      message: "请输入品牌名称",
      trigger: "blur"
    }
  ],
  logoUrl: [{ required: true, message: "请上传品牌Logo", trigger: "change" }]
};
function isHttpUrl(url?: string) {
  return /^https?:\/\//i.test(url ?? "");
}
function formatDate(value?: number) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function search() {
  query.pageNum = 1;
  void load();
}
async function edit(row?: Brand) {
  try {
    const data = row
      ? await pmsRequest<Brand>("get", `/brands/${row.brandId}`)
      : undefined;
    Object.assign(form, empty(), { brandId: undefined }, data, {
      isEnable: data?.isEnable ?? 1,
      logoUrl: data?.logoUrl ?? ""
    });
    visible.value = true;
  } catch (error) {
    ElMessage.error(error.message);
  }
}
async function save() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    await pmsRequest("post", "/brands", {
      ...form,
      name: form.name.trim()
    });
    visible.value = false;
    ElMessage.success("品牌已保存");
    await load();
  } catch (error) {
    ElMessage.error(error.message);
  } finally {
    saving.value = false;
  }
}
function onLogoUploading(value: boolean) {
  logoUploading.value = value;
}
async function remove(row: Brand) {
  try {
    await ElMessageBox.confirm(
      `确认删除品牌「${row.name}」？被商品引用的品牌不能删除。`,
      "删除品牌",
      { type: "warning" }
    );
  } catch {
    return;
  }
  try {
    await pmsRequest("delete", `/brands/${row.brandId}`);
    ElMessage.success("品牌已删除");
    await load();
  } catch (error) {
    ElMessage.error(error.message);
  }
}
onMounted(load);
</script>
<template>
  <div class="pms-page">
    <el-card shadow="never" class="query-card">
      <el-form inline @submit.prevent="search">
        <el-form-item label="关键词"
          ><el-input
            v-model="query.keyword"
            clearable
            placeholder="品牌名称"
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-select
            v-model="query.isEnable"
            clearable
            placeholder="全部状态"
            style="width: 140px"
            ><el-option label="启用" :value="1" /><el-option
              label="停用"
              :value="0" /></el-select
        ></el-form-item>
        <el-form-item
          ><el-button type="primary" @click="search">查询</el-button
          ><el-button
            @click="
              query.keyword = '';
              query.isEnable = undefined;
              search();
            "
            >重置</el-button
          ></el-form-item
        >
      </el-form>
    </el-card>
    <el-card shadow="never" class="content-card">
      <div class="heading">
        <p>维护独立品牌资料与启用状态</p>
        <el-button type="primary" @click="edit()">新增品牌</el-button>
      </div>

      <el-alert
        v-if="failure"
        :title="failure"
        type="error"
        :closable="false"
      />

      <el-table v-loading="loading" :data="rows" row-key="brandId">
        <el-table-column type="index" width="55" align="center" label="序号" />
        <el-table-column
          prop="name"
          label="品牌名称"
          min-width="100"
          show-overflow-tooltip
        /><el-table-column
          prop="englishName"
          label="英文名称"
          min-width="100"
          show-overflow-tooltip
        />
        <el-table-column
          prop="websiteUrl"
          label="官网"
          min-width="160"
          show-overflow-tooltip
          ><template #default="{ row }"
            ><el-link
              v-if="isHttpUrl(row.websiteUrl)"
              :href="row.websiteUrl"
              target="_blank"
              rel="noopener"
              type="primary"
              >{{ row.websiteUrl }}</el-link
            ><span v-else>{{ row.websiteUrl || "-" }}</span></template
          ></el-table-column
        >
        <el-table-column label="品牌logo" width="150" align="center"
          ><template #default="{ row }"
            ><el-image
              v-if="row.logoUrl"
              :src="row.logoUrl"
              fit="contain"
              class="logo-thumb"
              :preview-src-list="[row.logoUrl]"
              preview-teleported
              hide-on-click-modal
            /><span v-else>-</span></template
          ></el-table-column
        >
        <el-table-column label="状态" width="90" align="center"
          ><template #default="{ row }"
            ><el-tag :type="row.isEnable === 1 ? 'success' : 'info'">{{
              row.isEnable === 1 ? "启用" : "停用"
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column
          prop="creatorName"
          label="创建人"
          min-width="130"
          show-overflow-tooltip
          ><template #default="{ row }">{{
            row.creatorName || "-"
          }}</template></el-table-column
        >
        <el-table-column label="创建时间" min-width="180"
          ><template #default="{ row }">{{
            formatDate(row.createTime)
          }}</template></el-table-column
        >
        <el-table-column
          prop="updaterName"
          label="更新人"
          min-width="130"
          show-overflow-tooltip
          ><template #default="{ row }">{{
            row.updaterName || "-"
          }}</template></el-table-column
        >
        <el-table-column label="更新时间" min-width="180"
          ><template #default="{ row }">{{
            formatDate(row.updateTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" min-width="150" align="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="edit(row as Brand)"
              >编辑</el-button
            ><el-button link type="danger" @click="remove(row as Brand)"
              >删除</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="query.pageNum"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        class="pagination"
        @current-change="load"
        @size-change="search"
      />
    </el-card>
    <el-dialog
      v-model="visible"
      :title="form.brandId ? '编辑品牌' : '新增品牌'"
      width="min(680px,94vw)"
      destroy-on-close
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :disabled="saving"
        label-width="96px"
      >
        <el-form-item label="品牌名称" prop="name"
          ><el-input v-model="form.name" maxlength="128"
        /></el-form-item>
        <el-form-item label="英文名称"
          ><el-input v-model="form.englishName" maxlength="128"
        /></el-form-item>
        <el-form-item label="Logo" prop="logoUrl"
          ><BrandLogoUpload
            v-model="form.logoUrl"
            :disabled="saving"
            @uploading="onLogoUploading"
        /></el-form-item>
        <el-form-item label="官网地址"
          ><el-input v-model="form.websiteUrl" maxlength="1000"
        /></el-form-item>
        <el-form-item label="品牌描述"
          ><el-input v-model="form.description" type="textarea" :rows="3"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-radio-group v-model="form.isEnable"
            ><el-radio :value="1">启用</el-radio
            ><el-radio :value="0">停用</el-radio></el-radio-group
          ></el-form-item
        >
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="visible = false">取消</el-button
        ><el-button
          type="primary"
          :loading="saving"
          :disabled="logoUploading"
          @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </div>
</template>
<style scoped>
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

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.logo-thumb {
  /* 块级显示：120px 行内块会比 .cell 内容区宽 4px，触发 .cell 的
     text-overflow: ellipsis，在右下角画出"··"杂点 */
  display: block;
  margin: 0 auto;
  width: 120px;
  height: 56px;
  border-radius: 4px;
}
</style>
