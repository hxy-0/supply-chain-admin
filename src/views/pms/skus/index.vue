<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { ElMessage, type FormInstance } from "element-plus";
import { pmsRequest, type Sku, type SkuImage, type Id } from "@/api/pms";
import type { PageResult } from "@/api/tms";
import { useRouter, useRoute } from "vue-router";
import SkuFields from "../components/SkuFields.vue";
import { usePmsPage } from "../composables/usePmsPage";
defineOptions({ name: "PmsSkus" });
import SkuImages from "../components/SkuImages.vue";
import {
  getProducts,
  getProduct,
  getCategoryAttributes,
  getEnabledAttributes,
  saveProduct,
  type Product,
  type ProductCommand,
  type Attribute,
  type CategoryAttribute
} from "@/api/pms";
import ProductSpecifications from "../components/ProductSpecifications.vue";
import ProductSkuTable from "../components/ProductSkuTable.vue";
const generationDialog = ref(false);
const generationLoading = ref(false);
const generationSaving = ref(false);
const generationDirty = ref(false);
const productOptions = ref<Product[]>([]);
const selectedProduct = ref<Id>();
const generation = ref<ProductCommand>();
const generationOptions = ref<(Attribute | CategoryAttribute)[]>([]);
const availableSales = computed(() =>
  generationOptions.value.filter(
    item =>
      !generation.value?.attributes.some(
        parameter => String(parameter.attributeId) === String(item.attributeId)
      )
  )
);
async function startGeneration() {
  try {
    generationLoading.value = true;
    productOptions.value = [];
    let pageNum = 1;
    while (true) {
      const page = await getProducts({ pageNum, pageSize: 200 });
      productOptions.value.push(
        ...page.records.filter(
          product => product.status === 0 || product.status === 2
        )
      );
      if (pageNum * 200 >= Number(page.total)) break;
      pageNum++;
    }
    generation.value = undefined;
    selectedProduct.value = filters.productId;
    generationDialog.value = true;
    if (selectedProduct.value) await selectGenerationProduct();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "商品加载失败");
  } finally {
    generationLoading.value = false;
  }
}
async function selectGenerationProduct() {
  generation.value = undefined;
  if (!selectedProduct.value) return;
  generationLoading.value = true;
  try {
    const product = await getProduct(selectedProduct.value);
    const [template, attributes] = await Promise.all([
      getCategoryAttributes(product.categoryId),
      getEnabledAttributes()
    ]);
    generationOptions.value = template.length
      ? template.filter(item => item.attributeKind === 1)
      : attributes.filter(item => item.inputType !== 3);
    const axes = new Map<string, ProductCommand["salesAttributes"][number]>();
    for (const detail of product.skus ?? []) {
      if (detail.sku.isEnable !== 1) continue;
      for (const attribute of detail.attributes) {
        const key = String(attribute.attributeId);
        if (!axes.has(key))
          axes.set(key, {
            attributeId: attribute.attributeId,
            valueIds: [],
            sortOrder: axes.size
          });
        const axis = axes.get(key)!;
        if (
          !axis.valueIds.some(
            id => String(id) === String(attribute.attributeValueId)
          )
        )
          axis.valueIds.push(attribute.attributeValueId);
      }
    }
    generation.value = {
      ...product,
      attributes: product.attributes ?? [],
      images: product.images ?? [],
      salesAttributes: [...axes.values()],
      skus: (product.skus ?? []).map(detail => ({
        ...detail.sku,
        images: detail.images ?? []
      }))
    };
    generationDirty.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "配置加载失败");
  } finally {
    generationLoading.value = false;
  }
}
function generated(
  selections: ProductCommand["salesAttributes"],
  skus: ProductCommand["skus"]
) {
  generation.value!.salesAttributes = selections;
  generation.value!.skus = skus;
  generationDirty.value = false;
}
async function saveGeneration() {
  if (
    !generation.value ||
    generationDirty.value ||
    !generation.value.skus.length
  ) {
    ElMessage.warning("请先生成 SKU 后再保存");
    return;
  }
  generationSaving.value = true;
  try {
    await saveProduct(generation.value);
    generationDialog.value = false;
    ElMessage.success("SKU 已生成并保存");
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "生成失败");
  } finally {
    generationSaving.value = false;
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
const filters = reactive({
  keyword: "",
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
onMounted(load);
</script>
<template>
  <div class="pms-page">
    <el-dialog
      v-model="generationDialog"
      title="生成 SKU"
      width="min(1100px, 95vw)"
      destroy-on-close
      :close-on-click-modal="false"
      :show-close="!generationSaving"
      :close-on-press-escape="!generationSaving"
    >
      <el-select
        v-model="selectedProduct"
        filterable
        placeholder="选择草稿或已下架的 SPU"
        :disabled="generationLoading || generationSaving"
        @change="selectGenerationProduct"
      >
        <el-option
          v-for="product in productOptions"
          :key="product.productId"
          :label="product.name + ' / ' + product.productCode"
          :value="product.productId"
        />
      </el-select>
      <div v-if="generation" v-loading="generationLoading">
        <el-alert
          title="调整规格后，旧组合停用、新组合新建；相同组合保留已有资料。"
          type="info"
          :closable="false"
        />
        <ProductSpecifications
          :key="String(generation.productId)"
          :options="availableSales"
          :selections="generation.salesAttributes"
          :skus="generation.skus"
          :disabled="generationLoading || generationSaving"
          @generated="generated"
          @dirty="generationDirty = $event"
          @refresh="selectGenerationProduct"
        />
        <ProductSkuTable
          v-model="generation.skus"
          :disabled="generationSaving || generationDirty"
        />
      </div>
      <template #footer>
        <el-button
          :disabled="generationSaving"
          @click="generationDialog = false"
          >取消</el-button
        >
        <el-button
          type="primary"
          :loading="generationSaving"
          :disabled="generationLoading || !generation || generationDirty"
          @click="saveGeneration"
          >保存 SKU</el-button
        >
      </template>
    </el-dialog>
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
              filters.keyword = '';
              filters.isEnable = undefined;
              search();
            "
            >重置</el-button
          ></el-form-item
        >
      </el-form>
    </el-card>
    <el-card shadow="never" class="content-card">
      <div class="heading">
        <p>选择 SPU 生成 SKU，维护零售价、条码和履约尺寸。</p>
        <el-button
          type="primary"
          :loading="generationLoading"
          @click="startGeneration"
          >生成 SKU</el-button
        >
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
            ><el-tag :type="row.sku.isEnable === 1 ? 'success' : 'info'">{{
              row.sku.isEnable === 1 ? "启用" : "停用"
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
          ><el-empty description="暂无 SKU，选择 SPU 后生成 SKU"
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

.heading p {
  margin: 0;
  color: var(--el-text-color-secondary);
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
