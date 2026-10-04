<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, type FormInstance } from "element-plus";
import { pmsRequest, type Sku } from "@/api/pms";
import type { PageResult } from "@/api/tms";
import { useRouter } from "vue-router";
defineOptions({ name: "PmsSkus" });
const router = useRouter();
interface SkuRow {
  sku: Sku;
  productName: string;
  productCode: string;
}
const filters = reactive({
  keyword: "",
  status: undefined,
  pageNum: 1,
  pageSize: 20
});
const rows = ref<SkuRow[]>([]);
const total = ref(0);
const loading = ref(false);
const error = ref("");
const dialog = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const form = reactive<Sku>({
  specSignature: "",
  retailPrice: 0,
  currencyCode: "CNY",
  status: 1
});
let sequence = 0;
async function load() {
  const current = ++sequence;
  loading.value = true;
  error.value = "";
  try {
    const page = await pmsRequest<PageResult<SkuRow>>(
      "get",
      "/skus",
      undefined,
      { ...filters, keyword: filters.keyword.trim() || undefined }
    );
    if (current !== sequence) return;
    rows.value = page.records;
    total.value = Number(page.total);
  } catch (e) {
    if (current === sequence) error.value = e.message;
  } finally {
    if (current === sequence) loading.value = false;
  }
}
function search() {
  filters.pageNum = 1;
  void load();
}
async function edit(row: SkuRow) {
  try {
    Object.assign(form, await pmsRequest<Sku>("get", `/skus/${row.sku.skuId}`));
    dialog.value = true;
  } catch (e) {
    ElMessage.error(e.message);
  }
}
async function save() {
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    await pmsRequest("patch", `/skus/${form.skuId}`, form);
    dialog.value = false;
    ElMessage.success("SKU 已保存");
    await load();
  } catch (e) {
    ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<template>
  <el-card shadow="never">
    <div class="heading">
      <h2>SKU 管理</h2>
      <p>维护零售价、条码和履约尺寸；新增规格请在 SPU 管理中操作。</p>
    </div>
    <el-form inline @submit.prevent="search">
      <el-form-item label="关键词"
        ><el-input
          v-model="filters.keyword"
          placeholder="商品名 / SKU 编码 / 条码"
          clearable
          @keyup.enter="search"
      /></el-form-item>
      <el-form-item label="状态"
        ><el-select
          v-model="filters.status"
          clearable
          style="width: 140px"
          placeholder="全部状态"
          ><el-option label="启用" :value="1" /><el-option
            label="停用"
            :value="0" /></el-select
      ></el-form-item>
      <el-form-item
        ><el-button type="primary" @click="search">查询</el-button
        ><el-button
          @click="
            filters.keyword = '';
            filters.status = undefined;
            search();
          "
          >重置</el-button
        ></el-form-item
      >
    </el-form>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table
      v-loading="loading"
      :data="rows"
      :row-key="row => String(row.sku.skuId)"
    >
      <el-table-column
        prop="productName"
        label="所属 SPU"
        min-width="160"
      /><el-table-column prop="sku.skuCode" label="SKU 编码" min-width="140" />
      <el-table-column label="规格" min-width="180"
        ><template #default="{ row }">{{
          row.sku.specText || "默认规格"
        }}</template></el-table-column
      >
      <el-table-column
        prop="sku.barcode"
        label="条码"
        min-width="140"
      /><el-table-column
        prop="sku.retailPrice"
        label="零售价"
        width="120"
      /><el-table-column prop="sku.currencyCode" label="币种" width="90" />
      <el-table-column label="状态" width="100"
        ><template #default="{ row }"
          ><el-tag :type="row.sku.status === 1 ? 'success' : 'info'">{{
            row.sku.status === 1 ? "启用" : "停用"
          }}</el-tag></template
        ></el-table-column
      >
      <el-table-column label="操作" width="150"
        ><template #default="{ row }"
          ><el-button type="primary" link @click="edit(row as SkuRow)"
            >编辑</el-button
          ></template
        ></el-table-column
      >
      <template #empty
        ><el-empty description="暂无 SKU，在 SPU 管理中创建商品"
          ><el-button @click="router.push('/pms/products')"
            >前往 SPU 管理</el-button
          ></el-empty
        ></template
      >
    </el-table>
    <el-pagination
      v-model:current-page="filters.pageNum"
      v-model:page-size="filters.pageSize"
      :total="total"
      :page-sizes="[20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      class="pagination"
      @current-change="load"
      @size-change="search"
    />
    <el-dialog
      v-model="dialog"
      title="编辑 SKU"
      width="min(760px,94vw)"
      destroy-on-close
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
    >
      <el-form
        ref="formRef"
        :model="form"
        label-width="100px"
        :disabled="saving"
      >
        <el-form-item label="规格">{{
          form.specText || "默认规格"
        }}</el-form-item>
        <el-form-item label="SKU 编码"
          ><el-input v-model="form.skuCode" maxlength="64"
        /></el-form-item>
        <el-form-item label="条码"
          ><el-input v-model="form.barcode" maxlength="64"
        /></el-form-item>
        <el-form-item label="SKU 名称"
          ><el-input v-model="form.name" maxlength="255"
        /></el-form-item>
        <el-form-item
          label="零售价"
          prop="retailPrice"
          :rules="[{ required: true, message: '请输入零售价' }]"
          ><el-input-number v-model="form.retailPrice" :min="0" :precision="4"
        /></el-form-item>
        <el-form-item
          label="币种"
          prop="currencyCode"
          :rules="[
            {
              required: true,
              pattern: /^[A-Z]{3}$/,
              message: '请输入三位大写币种，如 CNY'
            }
          ]"
          ><el-input v-model="form.currencyCode" maxlength="3"
        /></el-form-item>
        <el-form-item
          v-for="field in [
            { key: 'weightKg', label: '重量 (kg)' },
            { key: 'lengthCm', label: '长 (cm)' },
            { key: 'widthCm', label: '宽 (cm)' },
            { key: 'heightCm', label: '高 (cm)' }
          ]"
          :key="field.key"
          :label="field.label"
          ><el-input-number v-model="form[field.key]" :min="0" :precision="4"
        /></el-form-item>
        <el-form-item label="状态"
          ><el-radio-group v-model="form.status"
            ><el-radio :value="1">启用</el-radio
            ><el-radio :value="0">停用</el-radio></el-radio-group
          ></el-form-item
        >
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="dialog = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
          >保存</el-button
        ></template
      >
    </el-dialog>
  </el-card>
</template>
<style scoped>
.heading {
  margin-bottom: 24px;
}

.heading h2 {
  margin: 0;
  font-size: 20px;
}

.heading p {
  color: var(--el-text-color-secondary);
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
