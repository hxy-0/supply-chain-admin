<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import ProductSpecifications from "../components/ProductSpecifications.vue";
import ProductParameters from "../components/ProductParameters.vue";
import ProductSkuTable from "../components/ProductSkuTable.vue";
import SkuImages from "../components/SkuImages.vue";
import SkuFields from "../components/SkuFields.vue";
import ProductImages from "../components/ProductImages.vue";
import type { PageResult } from "@/api/tms";
import { categoryOptions } from "../category-options";
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules
} from "element-plus";
import {
  changeProductStatus,
  getBrands,
  getCategories,
  getProduct,
  getProducts,
  saveProduct,
  pmsRequest,
  type Id,
  type Brand,
  type Category,
  type Product,
  type ProductCommand,
  getEnabledAttributes,
  getCategoryAttributes,
  type Attribute,
  type CategoryAttribute,
  type SkuDetail
} from "@/api/pms";

import { useRouter } from "vue-router";
defineOptions({ name: "PmsProducts" });
const router = useRouter();
async function removeDraft(product: Product) {
  try {
    await ElMessageBox.confirm(
      `删除草稿「${product.name}」及其 SKU？`,
      "删除草稿",
      { type: "warning" }
    );
  } catch {
    return;
  }
  try {
    await pmsRequest("delete", `/products/${product.productId}`);
    ElMessage.success("草稿已删除");
    await loadProducts();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}
const statuses = ["草稿", "已上架", "已下架", "已归档"];
const tagTypes = ["info", "success", "warning", "info"] as const;
const filters = reactive({
  keyword: "",
  categoryId: undefined,
  brandId: undefined,
  status: undefined,
  pageNum: 1,
  pageSize: 20
});
const products = ref<Product[]>([]);
const total = ref(0);
const loading = ref(false);
const categories = ref<Category[]>([]);
const brands = ref<Brand[]>([]);
const optionError = ref("");
const listError = ref("");
const categoryTree = computed(() => categoryOptions(categories.value));
const enabledCategoryTree = computed(() =>
  categoryOptions(categories.value, { enabledOnly: true })
);
const enabledBrands = computed(() =>
  brands.value.filter(brand => brand.status === 1)
);
const dialog = ref(false);
const readonly = ref(false);
const saving = ref(false);
const formRef = ref<FormInstance>();
const detail = ref<Product>();
const skuDetails = ref<SkuDetail[]>([]);
const hasSpecifications = computed(
  () => !!form.productId && form.skus.some(sku => sku.specSignature !== "")
);
const form = reactive<ProductCommand>(emptyForm());
const specificationsDirty = ref(false);
const editSpecifications = ref(false);
watch(editSpecifications, value => {
  if (value) specificationsDirty.value = true;
});
const template = ref<CategoryAttribute[]>([]);
const attributeOptions = ref<Attribute[]>([]);
const templateLoading = ref(false);
const templateError = ref("");
const salesOptions = computed(() =>
  template.value.length
    ? template.value.filter(item => item.attributeKind === 1)
    : attributeOptions.value.filter(
        item =>
          item.inputType !== 3 &&
          !form.attributes.some(
            parameter =>
              String(parameter.attributeId) === String(item.attributeId)
          )
      )
);
const parameterOptions = computed(() =>
  template.value.length
    ? template.value.filter(item => item.attributeKind === 2)
    : attributeOptions.value.filter(
        item =>
          !form.salesAttributes.some(
            axis => String(axis.attributeId) === String(item.attributeId)
          )
      )
);
let templateRequest = 0;
async function loadTemplate() {
  const request = ++templateRequest;
  templateLoading.value = true;
  templateError.value = "";
  try {
    const [items, all] = await Promise.all([
      form.categoryId
        ? getCategoryAttributes(form.categoryId)
        : Promise.resolve([]),
      getEnabledAttributes()
    ]);
    if (request !== templateRequest) return;
    template.value = items;
    attributeOptions.value = all;
  } catch (error) {
    if (request === templateRequest) templateError.value = errorMessage(error);
  } finally {
    if (request === templateRequest) templateLoading.value = false;
  }
}
watch(
  () => form.categoryId,
  () => {
    if (dialog.value) void loadTemplate();
  }
);
function changeCategory() {
  form.attributes = [];
  form.salesAttributes = [];
  form.skus = emptyForm().skus;
  specificationsDirty.value = false;
  const category = categories.value.find(
    item => String(item.catId) === String(form.categoryId)
  );
  form.productUnit = category?.productUnit || "";
}
function generated(
  selections: ProductCommand["salesAttributes"],
  skus: ProductCommand["skus"]
) {
  form.salesAttributes = selections;
  form.skus = skus;
}

const rules: FormRules = {
  productCode: [
    {
      required: true,
      whitespace: true,
      message: "请输入商品编码",
      trigger: "blur"
    }
  ],
  name: [
    {
      required: true,
      whitespace: true,
      message: "请输入商品名称",
      trigger: "blur"
    }
  ],
  categoryId: [{ required: true, message: "请选择商品类别", trigger: "change" }]
};
function emptyForm(): ProductCommand {
  return {
    productCode: "",
    name: "",
    categoryId: undefined,
    brandId: undefined,
    subtitle: "",
    productUnit: "",
    mainImageUrl: "",
    description: "",
    sortOrder: 0,
    attributes: [],
    images: [],
    salesAttributes: [],
    skus: [
      {
        specSignature: "",
        retailPrice: 0,
        currencyCode: "CNY",
        status: 1,
        isDefault: true,
        images: []
      }
    ]
  };
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
let listRequest = 0;
async function loadProducts() {
  const request = ++listRequest;
  loading.value = true;
  listError.value = "";
  try {
    const page = await getProducts({
      ...filters,
      keyword: filters.keyword.trim() || undefined
    });
    if (request !== listRequest) return;
    products.value = page.records;
    total.value = Number(page.total);
  } catch (error) {
    if (request === listRequest) listError.value = errorMessage(error);
  } finally {
    if (request === listRequest) loading.value = false;
  }
}
async function loadOptions() {
  optionError.value = "";
  try {
    const [categoryData, brandData] = await Promise.all([
      getCategories(),
      getBrands()
    ]);
    categories.value = categoryData;
    brands.value = brandData;
  } catch (error) {
    optionError.value = errorMessage(error);
  }
}
function search() {
  filters.pageNum = 1;
  void loadProducts();
}
function reset() {
  Object.assign(filters, {
    keyword: "",
    categoryId: undefined,
    brandId: undefined,
    status: undefined,
    pageNum: 1
  });
  void loadProducts();
}
function create() {
  editSpecifications.value = false;
  specificationsDirty.value = false;
  detail.value = undefined;
  skuDetails.value = [];
  Object.assign(form, emptyForm(), {
    productId: undefined,
    version: undefined
  });
  readonly.value = false;
  dialog.value = true;
  void loadTemplate();
}
async function open(product: Product, view = false) {
  try {
    const data = await getProduct(product.productId);
    detail.value = data;
    skuDetails.value = data.skus ?? [];
    readonly.value = view || data.status === 3;
    Object.assign(form, emptyForm(), {
      productId: data.productId,
      version: data.version,
      productCode: data.productCode,
      name: data.name,
      categoryId: data.categoryId,
      brandId: data.brandId,
      subtitle: data.subtitle,
      productUnit: data.productUnit,
      mainImageUrl: data.mainImageUrl,
      description: data.description,
      sortOrder: data.sortOrder,
      attributes: data.attributes ?? [],
      images: (data.images ?? []).map(image => ({
        ...image,
        imageType: image.imageType
      })),
      skus: skuDetails.value.map(item => ({
        ...item.sku,
        status: item.sku.status,
        images: item.images ?? []
      }))
    });
    const axes = new Map<
      string,
      { attributeId: Id; valueIds: Id[]; sortOrder: number }
    >();
    const active = skuDetails.value.filter(item => item.sku.status === 1);
    for (const item of active.length ? active : skuDetails.value)
      for (const value of item.attributes) {
        const key = String(value.attributeId);
        if (!axes.has(key))
          axes.set(key, {
            attributeId: value.attributeId,
            valueIds: [],
            sortOrder: axes.size
          });
        const axis = axes.get(key)!;
        if (
          !axis.valueIds.some(
            id => String(id) === String(value.attributeValueId)
          )
        )
          axis.valueIds.push(value.attributeValueId);
      }
    form.salesAttributes = [...axes.values()];
    editSpecifications.value = false;
    specificationsDirty.value = false;
    dialog.value = true;
    void loadTemplate();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}
async function save() {
  if (
    (!form.productId || editSpecifications.value) &&
    specificationsDirty.value
  ) {
    ElMessage.warning("销售属性已变更，请重新生成 SKU 后再保存");
    return;
  }
  if (templateLoading.value || templateError.value) {
    ElMessage.warning("请等待分类模板加载完成，失败时请重试");
    return;
  }
  if (form.images.some(image => !image.imageUrl.trim())) {
    ElMessage.warning("请填写每张图片的地址");
    return;
  }
  if (!(await formRef.value?.validate().catch(() => false))) return;
  saving.value = true;
  try {
    const command = {
      ...form,
      productCode: form.productCode.trim(),
      name: form.name.trim()
    };
    if (form.productId && !editSpecifications.value)
      await pmsRequest("patch", `/products/${form.productId}/details`, command);
    else await saveProduct(command);
    ElMessage.success(form.productId ? "商品已保存" : "商品草稿已创建");
    dialog.value = false;
    await loadProducts();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}
const busy = ref<string>();
async function transition(
  product: Product,
  action: "publish" | "unpublish" | "archive"
) {
  const verb = { publish: "上架", unpublish: "下架", archive: "归档" }[action];
  try {
    await ElMessageBox.confirm(
      action === "archive"
        ? `归档「${product.name}」后无法再次上架，是否继续？`
        : `确认${verb}「${product.name}」？`,
      `${verb}商品`,
      {
        type: "warning",
        confirmButtonText: `确认${verb}`,
        cancelButtonText: "取消"
      }
    );
  } catch {
    return;
  }
  busy.value = String(product.productId);
  try {
    await changeProductStatus(product.productId, action);
    ElMessage.success(`商品已${verb}`);
    await loadProducts();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    busy.value = undefined;
  }
}
function formatTime(timestamp?: number) {
  return timestamp
    ? new Date(Number(timestamp)).toLocaleString("zh-CN", { hour12: false })
    : "—";
}

onMounted(() => {
  void loadProducts();
  void loadOptions();
});
</script>

<template>
  <div class="product-page">
    <el-card shadow="never" class="query-card">
      <el-form inline :model="filters" @submit.prevent="search">
        <el-form-item label="关键词"
          ><el-input
            v-model="filters.keyword"
            placeholder="商品名称 / 编码"
            clearable
            @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="分类">
          <el-cascader
            v-model="filters.categoryId"
            :options="categoryTree"
            :props="{ emitPath: false }"
            placeholder="全部分类"
            filterable
            clearable
            class="category-select"
          />
        </el-form-item>
        <el-form-item label="品牌">
          <el-select
            v-model="filters.brandId"
            placeholder="全部品牌"
            filterable
            clearable
            class="filter-select"
          >
            <el-option
              v-for="brand in brands"
              :key="brand.brandId"
              :label="brand.name"
              :value="brand.brandId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select
            v-model="filters.status"
            placeholder="全部状态"
            clearable
            class="filter-select"
          >
            <el-option
              v-for="(status, index) in statuses"
              :key="index"
              :label="status"
              :value="index"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          ><el-button type="primary" @click="search">查询</el-button
          ><el-button @click="reset">重置</el-button></el-form-item
        >
      </el-form>
    </el-card>
    <el-card shadow="never" class="content-card">
      <div class="page-heading">
        <div>
          <h2>SPU 管理</h2>
          <p>维护商品资料、SKU 零售价与销售状态</p>
        </div>
        <el-button type="primary" :disabled="!!optionError" @click="create"
          >新增商品</el-button
        >
      </div>
      <el-alert
        v-if="optionError"
        type="error"
        :closable="false"
        class="error-alert"
      >
        分类或品牌加载失败：{{ optionError }}
        <el-button link type="primary" @click="loadOptions">重试</el-button>
      </el-alert>

      <el-alert
        v-if="listError"
        :title="listError"
        type="error"
        :closable="false"
        class="error-alert"
      />
      <el-table v-loading="loading" :data="products" row-key="productId">
        <el-table-column label="商品" min-width="260">
          <template #default="{ row }">
            <div class="product-summary">
              <el-image
                v-if="row.mainImageUrl"
                :src="row.mainImageUrl"
                fit="cover"
                class="product-cover"
                ><template #error><span>无图</span></template></el-image
              >
              <div>
                <el-button
                  link
                  type="primary"
                  @click="open(row as Product, true)"
                  >{{ row.name }}</el-button
                >
                <p class="product-code">{{ row.productCode }}</p>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="categoryName" label="分类" min-width="120" />
        <el-table-column prop="brandName" label="品牌" min-width="120" />
        <el-table-column prop="skuCount" label="SKU 数量" width="100" />
        <el-table-column label="状态" width="100"
          ><template #default="{ row }"
            ><el-tag :type="tagTypes[row.status]">{{
              statuses[row.status]
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="更新时间" min-width="180"
          ><template #default="{ row }">{{
            formatTime(row.updateTime)
          }}</template></el-table-column
        >
        <el-table-column label="操作" fixed="right" width="340">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click="
                router.push({
                  path: '/pms/skus',
                  query: { productId: String(row.productId) }
                })
              "
              >SKU</el-button
            >
            <el-button
              v-if="row.status === 0"
              link
              type="danger"
              @click="removeDraft(row as Product)"
              >删除</el-button
            >
            <el-button link type="primary" @click="open(row as Product, true)"
              >详情</el-button
            >
            <el-button
              v-if="row.status !== 3"
              link
              type="primary"
              @click="open(row as Product)"
              >编辑</el-button
            >
            <el-button
              v-if="row.status === 0 || row.status === 2"
              link
              type="success"
              :disabled="!!busy"
              @click="transition(row as Product, 'publish')"
              >上架</el-button
            >
            <el-button
              v-if="row.status === 1"
              link
              type="warning"
              :disabled="!!busy"
              @click="transition(row as Product, 'unpublish')"
              >下架</el-button
            >
            <el-button
              v-if="row.status !== 3"
              link
              type="danger"
              :disabled="!!busy"
              @click="transition(row as Product, 'archive')"
              >归档</el-button
            >
          </template>
        </el-table-column>
        <template #empty
          ><el-empty
            :description="
              listError
                ? '商品加载失败，请重试查询'
                : '暂无商品，点击新增商品创建草稿'
            "
        /></template>
      </el-table>
      <el-pagination
        v-model:current-page="filters.pageNum"
        v-model:page-size="filters.pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        class="pagination"
        @current-change="loadProducts"
        @size-change="search"
      />
    </el-card>
    <el-dialog
      v-model="dialog"
      :title="
        readonly ? '商品详情' : form.productId ? '编辑商品' : '新增商品草稿'
      "
      width="min(960px, 94vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      destroy-on-close
    >
      <el-alert
        v-if="!form.productId"
        title="新商品保存为草稿；可使用默认 SKU 或生成多规格 SKU，填写零售价后在列表上架。"
        type="info"
        :closable="false"
        class="error-alert"
      />
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        :disabled="readonly || saving"
        label-width="96px"
      >
        <el-row :gutter="20">
          <el-col :span="12"
            ><el-form-item label="商品编码" prop="productCode"
              ><el-input
                v-model="form.productCode"
                maxlength="64" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="商品名称" prop="name"
              ><el-input v-model="form.name" maxlength="255" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="商品类别" prop="categoryId">
              <el-cascader
                v-model="form.categoryId"
                :disabled="!!form.productId"
                :options="enabledCategoryTree"
                :props="{ emitPath: false }"
                filterable
                placeholder="请选择商品类别"
                class="full-width"
                @change="changeCategory"
              /> </el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="品牌">
              <el-select
                v-model="form.brandId"
                clearable
                filterable
                placeholder="可不选择品牌"
                class="full-width"
              >
                <el-option
                  v-if="
                    detail?.brandId &&
                    !enabledBrands.some(
                      b => String(b.brandId) === String(form.brandId)
                    )
                  "
                  :label="detail.brandName || String(form.brandId)"
                  :value="form.brandId!"
                  disabled
                />
                <el-option
                  v-for="brand in enabledBrands"
                  :key="brand.brandId"
                  :label="brand.name"
                  :value="brand.brandId"
                />
              </el-select> </el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="商品单位"
              ><el-input
                v-model="form.productUnit"
                maxlength="32"
                placeholder="件 / 箱 / 千克" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="排序"
              ><el-input-number
                v-model="form.sortOrder"
                :min="0"
                :precision="0" /></el-form-item
          ></el-col>
        </el-row>
        <el-form-item label="副标题"
          ><el-input v-model="form.subtitle" maxlength="500"
        /></el-form-item>
        <el-form-item label="主图地址"
          ><el-input
            v-model="form.mainImageUrl"
            maxlength="1000"
            placeholder="https://…"
        /></el-form-item>
        <el-form-item label="商品描述"
          ><el-input v-model="form.description" type="textarea" :rows="3"
        /></el-form-item>
        <el-divider content-position="left">SKU 与零售价</el-divider>

        <el-alert
          v-if="templateError"
          :title="templateError"
          type="error"
          :closable="false"
        />
        <el-button v-if="templateError" @click="loadTemplate"
          >重新加载模板</el-button
        >
        <el-checkbox
          v-if="form.productId && !readonly && detail?.status !== 1"
          v-model="editSpecifications"
          >调整商品规格（旧组合停用，新组合新建）</el-checkbox
        >
        <ProductSpecifications
          v-if="!readonly && (!form.productId || editSpecifications)"
          :key="String(form.productId || 'new') + ':' + String(form.categoryId)"
          :options="salesOptions"
          :selections="form.salesAttributes"
          :skus="form.skus"
          :disabled="
            templateLoading || saving || !!templateError || !form.categoryId
          "
          @generated="generated"
          @dirty="specificationsDirty = $event"
          @refresh="loadTemplate"
        />
        <el-divider content-position="left">普通参数</el-divider>
        <ProductParameters
          v-model="form.attributes"
          :options="parameterOptions"
          :disabled="readonly || saving"
        />
        <el-divider content-position="left">商品图片</el-divider>
        <ProductImages v-model="form.images" :disabled="readonly || saving" />

        <el-alert
          v-if="hasSpecifications && !readonly"
          title="此处编辑 SPU 基本资料，规格及价格在 SKU 管理中维护。"
          type="info"
          :closable="false"
        />
        <ProductSkuTable
          v-if="
            (!form.productId || editSpecifications) &&
            form.salesAttributes.length
          "
          v-model="form.skus"
          :disabled="saving"
        />

        <div
          v-if="
            !readonly &&
            (!form.productId || editSpecifications) &&
            form.skus.length === 1 &&
            (!hasSpecifications || editSpecifications) &&
            !form.salesAttributes.length
          "
          class="sku-form"
        >
          <SkuImages v-model="form.skus[0].images" :disabled="saving" />
          <SkuFields
            v-model:sku="form.skus[0]"
            prefix="skus.0"
            :disabled="saving"
          />
        </div>
        <el-table
          v-else-if="(form.productId && !editSpecifications) || readonly"
          :data="skuDetails.map(item => item.sku)"
        >
          <el-table-column prop="skuCode" label="SKU 编码" min-width="120" />
          <el-table-column label="规格" min-width="160"
            ><template #default="{ row }">{{
              row.specText || "默认规格"
            }}</template></el-table-column
          >
          <el-table-column prop="barcode" label="条码" min-width="120" />
          <el-table-column prop="retailPrice" label="零售价" width="110" />
          <el-table-column prop="currencyCode" label="币种" width="80" />
          <el-table-column label="状态" width="90"
            ><template #default="{ row }">{{
              row.status === 1 ? "启用" : "停用"
            }}</template></el-table-column
          >
        </el-table>
      </el-form>
      <template v-if="readonly && detail?.attributes?.length">
        <el-divider content-position="left">商品参数</el-divider>
        <el-descriptions :column="2" border
          ><el-descriptions-item
            v-for="(attribute, index) in detail.attributes"
            :key="index"
            :label="attribute.attributeName"
            >{{
              attribute.customValue || attribute.attributeValueName
            }}</el-descriptions-item
          ></el-descriptions
        >
      </template>
      <template #footer
        ><el-button :disabled="saving" @click="dialog = false">{{
          readonly ? "关闭" : "取消"
        }}</el-button
        ><el-button
          v-if="!readonly"
          type="primary"
          :loading="saving"
          @click="save"
          >保存{{ form.productId ? "" : "草稿" }}</el-button
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

.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-heading h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.page-heading p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
}

.category-select {
  width: 260px;
}

.filter-select {
  width: 150px;
}

.error-alert {
  margin-bottom: 16px;
}

.product-summary {
  display: flex;
  gap: 12px;
  align-items: center;
}

.product-cover {
  width: 44px;
  height: 44px;
  border-radius: 6px;
}

.product-code {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.pagination {
  justify-content: flex-end;
  margin-top: 20px;
}

.full-width {
  width: 100%;
}

.specifications {
  margin-bottom: 20px;
}

.specifications p {
  color: var(--el-text-color-secondary);
}

.axis {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.axis .el-select {
  flex: 1;
  min-width: 0;
}
</style>
