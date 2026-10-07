<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance } from "element-plus";
import { pmsRequest, type Sku, type SkuImage, type Id } from "@/api/pms";
import type { PageResult } from "@/api/tms";
import { useRouter, useRoute } from "vue-router";
import SkuFields from "../components/SkuFields.vue";
import { usePmsPage } from "../composables/usePmsPage";
import SkuPrices from "../components/SkuPrices.vue";
import SkuBarcode from "../components/SkuBarcode.vue";
defineOptions({ name: "PmsSkus" });
import SkuImages from "../components/SkuImages.vue";
import { getProducts, type Product } from "@/api/pms";
const productOptions = ref<Product[]>([]);
const productsLoading = ref(false);
async function loadProducts() {
  productsLoading.value = true;
  try {
    const products: Product[] = [];
    let pageNum = 1;
    while (true) {
      const page = await getProducts({ pageNum, pageSize: 200 });
      products.push(...page.records);
      if (!page.records.length || products.length >= Number(page.total)) break;
      pageNum++;
    }
    productOptions.value = products;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "SPU 加载失败");
  } finally {
    productsLoading.value = false;
  }
}
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
const priceDialog = ref(false);
const priceTargets = ref<Sku[]>([]);
function editPrices(items: SkuRow[]) {
  priceTargets.value = items.map(item => item.sku);
  priceDialog.value = true;
}
const selectedRows = ref<SkuRow[]>([]);
const barcodeGenerating = ref(false);
async function generateBarcodes(items: SkuRow[]) {
  if (barcodeGenerating.value) return;
  const skuIds = items
    .filter(item => !item.sku.barcode)
    .map(item => item.sku.skuId);
  if (!skuIds.length) {
    ElMessage.info("所选 SKU 已有条码");
    return;
  }
  barcodeGenerating.value = true;
  try {
    await pmsRequest("post", "/skus/barcodes", { skuIds });
    ElMessage.success("内部条码已生成");
    selectedRows.value = [];
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "条码生成失败");
  } finally {
    barcodeGenerating.value = false;
  }
}
const filters = reactive({
  skuCode: "",
  barcode: "",
  productId: route.query.productId
    ? (String(route.query.productId) as Id)
    : undefined,
  isEnable: undefined,
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
    skuCode: filters.skuCode.trim() || undefined,
    barcode: filters.barcode.trim() || undefined
  })
);
const dialog = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const form = reactive<Sku>({
  specSignature: "",

  isEnable: 1
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
onMounted(() => {
  void load();
  void loadProducts();
});
</script>
<template>
  <div class="pms-page">
    <SkuPrices
      v-model="priceDialog"
      :targets="priceTargets"
      @saved="
        selectedRows = [];
        load();
      "
    />
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
        <el-form-item label="SPU">
          <el-select
            v-model="filters.productId"
            filterable
            clearable
            :loading="productsLoading"
            placeholder="选择 SPU"
            style="width: 240px"
          >
            <el-option
              v-for="product in productOptions"
              :key="String(product.productId)"
              :label="product.name + ' / ' + product.productCode"
              :value="String(product.productId)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="SKU 编码"
          ><el-input
            v-model="filters.skuCode"
            placeholder="SKU 编码"
            clearable
            @keyup.enter="search"
        /></el-form-item>

        <el-form-item label="状态"
          ><el-select
            v-model="filters.isEnable"
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
              filters.productId = undefined;
              filters.skuCode = '';
              filters.barcode = '';
              filters.isEnable = undefined;
              search();
            "
            >重置</el-button
          ></el-form-item
        >
      </el-form>
    </el-card>
    <el-card shadow="never" class="content-card">
      <el-button
        type="primary"
        :loading="barcodeGenerating"
        :disabled="loading || !selectedRows.length"
        @click="generateBarcodes(selectedRows)"
      >
        生成所选内部条码
      </el-button>
      <el-button
        :disabled="loading || !selectedRows.length"
        @click="editPrices(selectedRows)"
        >批量维护价格</el-button
      >
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-table
        v-loading="loading"
        :data="rows"
        :row-key="row => String(row.sku.skuId)"
        @selection-change="selectedRows = $event"
      >
        <el-table-column type="selection" width="48" />
        <el-table-column
          prop="productName"
          label="所属 SPU"
          min-width="100"
        /><el-table-column
          prop="sku.skuCode"
          label="SKU 编码"
          min-width="180"
        />
        <el-table-column label="销售规格" min-width="240"
          ><template #default="{ row }">{{
            row.sku.specText || "默认规格"
          }}</template></el-table-column
        >
        <el-table-column label="条码" min-width="310" align="center">
          <template #default="{ row }">
            <SkuBarcode v-if="row.sku.barcode" :value="row.sku.barcode" />
            <el-button
              v-if="!row.sku.barcode"
              type="primary"
              link
              :disabled="barcodeGenerating"
              @click="generateBarcodes([row as SkuRow])"
              >生成内部条码</el-button
            >
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100"
          ><template #default="{ row }"
            ><el-tag :type="row.sku.isEnable === 1 ? 'success' : 'info'">{{
              row.sku.isEnable === 1 ? "启用" : "停用"
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="操作" width="220" align="center"
          ><template #default="{ row }"
            ><el-button type="primary" link @click="editPrices([row as SkuRow])"
              >价格维护</el-button
            ><el-button type="primary" link @click="editImages(row as SkuRow)"
              >图片</el-button
            ><el-button type="primary" link @click="edit(row as SkuRow)"
              >编辑</el-button
            ></template
          ></el-table-column
        >
        <template #empty
          ><el-empty description="暂无 SKU"
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
  justify-content: flex-start;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
