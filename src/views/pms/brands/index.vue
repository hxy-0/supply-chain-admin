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
defineOptions({ name: "PmsBrands" });
type BrandForm = Omit<Brand, "brandId" | "status"> & {
  brandId?: string | number;
  status: string;
};
const query = reactive({
  keyword: "",
  status: undefined,
  pageNum: 1,
  pageSize: 20
});
const rows = ref<Brand[]>([]);
const total = ref(0);
const loading = ref(false);
const failure = ref("");
const visible = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const empty = (): BrandForm => ({
  brandCode: "",
  name: "",
  englishName: "",
  logoUrl: "",
  websiteUrl: "",
  description: "",
  sortOrder: 0,
  status: "1"
});
const form = reactive<BrandForm>(empty());
const rules: FormRules = {
  brandCode: [
    {
      required: true,
      whitespace: true,
      message: "请输入品牌编码",
      trigger: "blur"
    }
  ],
  name: [
    {
      required: true,
      whitespace: true,
      message: "请输入品牌名称",
      trigger: "blur"
    }
  ]
};
let sequence = 0;
async function load() {
  const current = ++sequence;
  loading.value = true;
  failure.value = "";
  try {
    const page = await pmsRequest<PageResult<Brand>>(
      "get",
      "/brands",
      undefined,
      { ...query, keyword: query.keyword.trim() || undefined }
    );
    if (current !== sequence) return;
    rows.value = page.records;
    total.value = Number(page.total);
  } catch (error) {
    if (current === sequence) failure.value = error.message || "品牌加载失败";
  } finally {
    if (current === sequence) loading.value = false;
  }
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
      status: String(data?.status ?? 1)
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
      name: form.name.trim(),
      brandCode: form.brandCode.trim()
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
  <el-card shadow="never">
    <div class="heading">
      <div>
        <h2>品牌管理</h2>
        <p>维护独立品牌资料与启用状态</p>
      </div>
      <el-button type="primary" @click="edit()">新增品牌</el-button>
    </div>
    <el-form inline @submit.prevent="search">
      <el-form-item label="关键词"
        ><el-input
          v-model="query.keyword"
          clearable
          placeholder="品牌名称 / 编码"
          @keyup.enter="search"
      /></el-form-item>
      <el-form-item label="状态"
        ><el-select
          v-model="query.status"
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
            query.status = undefined;
            search();
          "
          >重置</el-button
        ></el-form-item
      >
    </el-form>
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" row-key="brandId">
      <el-table-column
        prop="brandCode"
        label="品牌编码"
        min-width="140"
      /><el-table-column
        prop="name"
        label="品牌名称"
        min-width="160"
      /><el-table-column prop="englishName" label="英文名称" min-width="160" />
      <el-table-column
        prop="websiteUrl"
        label="官网"
        min-width="180"
        show-overflow-tooltip
      />
      <el-table-column label="状态" width="100"
        ><template #default="{ row }"
          ><el-tag :type="row.status === 1 ? 'success' : 'info'">{{
            row.status === 1 ? "启用" : "停用"
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column prop="sortOrder" label="排序" width="90" />
      <el-table-column label="操作" width="150"
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
      :page-sizes="[20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      class="pagination"
      @current-change="load"
      @size-change="search"
    />
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
        <el-form-item label="品牌编码" prop="brandCode"
          ><el-input v-model="form.brandCode" maxlength="64"
        /></el-form-item>
        <el-form-item label="品牌名称" prop="name"
          ><el-input v-model="form.name" maxlength="128"
        /></el-form-item>
        <el-form-item label="英文名称"
          ><el-input v-model="form.englishName" maxlength="128"
        /></el-form-item>
        <el-form-item label="Logo 地址"
          ><el-input v-model="form.logoUrl" maxlength="1000"
        /></el-form-item>
        <el-form-item label="官网地址"
          ><el-input v-model="form.websiteUrl" maxlength="1000"
        /></el-form-item>
        <el-form-item label="品牌描述"
          ><el-input v-model="form.description" type="textarea" :rows="3"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-radio-group v-model="form.status"
            ><el-radio value="1">启用</el-radio
            ><el-radio value="0">停用</el-radio></el-radio-group
          ></el-form-item
        >
        <el-form-item label="排序"
          ><el-input-number v-model="form.sortOrder" :min="0" :precision="0"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="visible = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </el-card>
</template>
<style scoped>
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

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
