<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance } from "element-plus";
import { pmsRequest, type Sku, type SkuImage, type Id } from "@/api/pms";
import type { PageResult } from "@/api/tms";
import { useRouter, useRoute } from "vue-router";
import SkuFields from "../components/SkuFields.vue";
import { usePmsPage } from "../composables/usePmsPage";
defineOptions({ name: "PmsSkus" });
import SkuImages from "../components/SkuImages.vue";
const router = useRouter();
const route = useRoute();
const images = ref<SkuImage[]>([]);
const imageDialog = ref(false);
const imageSaving = ref(false);
const imageSku = ref<Sku>();
async function editImages(row: SkuRow) {
  try {
    const [sku, items] = await Promise.all([
      pmsRequest<Sku>("get", `/skus/${row.sku.skuId}`),
      pmsRequest<SkuImage[]>("get", `/skus/${row.sku.skuId}/images`)
    ]);
    imageSku.value = sku;
    images.value = items;
    imageDialog.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "图片加载失败");
  }
}
async function saveImages() {
  if (images.value.some(image => !image.imageUrl.trim())) {
    ElMessage.warning("请填写图片地址");
    return;
  }
  imageSaving.value = true;
  try {
    await pmsRequest("post", `/skus/${imageSku.value!.skuId}/images`, {
      version: imageSku.value!.version,
      images: images.value
    });
    imageDialog.value = false;
    ElMessage.success("图片已保存");
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败");
  } finally {
    imageSaving.value = false;
  }
}
interface SkuRow {
  sku: Sku;
  productName: string;
  productCode: string;
}
const filters = reactive({
  keyword: "",
  productId: route.query.productId
    ? (String(route.query.productId) as Id)
    : undefined,
  status: undefined,
  pageNum: 1,
  pageSize: 20
});
const {
  rows,
  total,
  loading,
  failure: error,
  load
} = usePmsPage(() =>
  pmsRequest<PageResult<SkuRow>>("get", "/skus", undefined, {
    ...filters,
    keyword: filters.keyword.trim() || undefined
  })
);
const dialog = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const form = reactive<Sku>({
  specSignature: "",
  retailPrice: 0,
  currencyCode: "CNY",
  status: 1
});
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
watch(
  () => route.query.productId,
  value => {
    filters.productId = value ? String(value) : undefined;
    search();
  }
);
onMounted(load);
</script>
<template>
  <div class="pms-page">
    <el-alert
      v-if="filters.productId"
      :title="'当前筛选 SPU：' + filters.productId"
      type="info"
      :closable="false"
      ><el-button link @click="router.replace('/pms/skus')"
        >查看全部 SKU</el-button
      ></el-alert
    >
    <el-dialog
      v-model="imageDialog"
      title="SKU 图片"
      width="min(820px,95vw)"
      destroy-on-close
      :close-on-click-modal="false"
      :show-close="!imageSaving"
      :close-on-press-escape="!imageSaving"
      ><SkuImages v-model="images" :disabled="imageSaving" /><template #footer
        ><el-button :disabled="imageSaving" @click="imageDialog = false"
          >取消</el-button
        ><el-button type="primary" :loading="imageSaving" @click="saveImages"
          >保存</el-button
        ></template
      ></el-dialog
    >
    <el-card shadow="never" class="query-card">
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
    </el-card>
    <el-card shadow="never" class="content-card">
      <div class="heading">
        <h2>SKU 管理</h2>
        <p>维护零售价、条码和履约尺寸；新增规格请在 SPU 管理中操作。</p>
      </div>

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
        /><el-table-column
          prop="sku.skuCode"
          label="SKU 编码"
          min-width="140"
        />
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
        <el-table-column label="操作" width="170"
          ><template #default="{ row }"
            ><el-button type="primary" link @click="editImages(row as SkuRow)"
              >图片</el-button
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
    </el-card>
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
        <SkuFields v-model:sku="form" :disabled="saving" />
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="dialog = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="save"
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
