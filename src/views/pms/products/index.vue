<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import ProductParameters from "../components/ProductParameters.vue";
import ProductImages from "../components/ProductImages.vue";
import ProductSpecifications from "../components/ProductSpecifications.vue";
import ProductSkuTable from "../components/ProductSkuTable.vue";
import { categoryOptions } from "../category-options";
import { formatDateTime } from "@/utils/date";
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
  type Brand,
  type Category,
  type Product,
  type ProductCommand,
  getCategoryAttributes,
  type CategoryAttribute
} from "@/api/pms";

defineOptions({ name: "PmsProducts" });

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
  brands.value.filter(brand => brand.isEnable === 1)
);
const dialog = ref(false);
const readonly = ref(false);
const saving = ref(false);
const imagesUploading = ref(false);
const formRef = ref<FormInstance>();
const detail = ref<Product>();
const form = reactive<ProductCommand>(emptyForm());
const template = ref<CategoryAttribute[]>([]);
const templateLoading = ref(false);
const templateError = ref("");
const editorKey = ref(0);
const specificationsDirty = ref(false);
const specificationsLoading = ref(false);
const specificationsLocked = computed(
  () => readonly.value || saving.value || detail.value?.status === 1
);
const salesOptions = computed(() =>
  template.value
    .filter(item => item.attributeKind === 1)
    .filter(
      item =>
        !form.attributes.some(
          parameter =>
            String(parameter.attributeId) === String(item.attributeId)
        )
    )
);
function generated(
  selections: ProductCommand["salesAttributes"],
  skus: ProductCommand["skus"]
) {
  form.salesAttributes = selections;
  form.skus = skus;
  specificationsDirty.value = false;
}

const parameterOptions = computed(() =>
  template.value.filter(item => item.attributeKind === 2)
);
let templateRequest = 0;
async function loadTemplate() {
  const request = ++templateRequest;
  templateLoading.value = true;
  templateError.value = "";
  template.value = [];
  try {
    const items = form.categoryId
      ? await getCategoryAttributes(form.categoryId)
      : [];
    if (request !== templateRequest) return;
    template.value = items;
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
  },
  { flush: "sync" }
);
function changeCategory() {
  specificationsDirty.value = false;
  form.attributes = [];
  form.salesAttributes = [];
  form.skus = emptyForm().skus;
  const category = categories.value.find(
    item => String(item.catId) === String(form.categoryId)
  );
  form.productUnit = category?.productUnit || "";
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
    skus: []
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
  editorKey.value++;
  specificationsDirty.value = false;
  detail.value = undefined;
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
    readonly.value = view || data.status === 3;
    editorKey.value++;
    specificationsDirty.value = false;
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
      salesAttributes: data.salesAttributes ?? [],
      skus: (data.skus ?? [])
        .filter(item => item.sku.isEnable === 1)
        .map(item => ({ ...item.sku, images: item.images ?? [] }))
    });
    if (
      data.mainImageUrl &&
      !form.images.some(image => image.imageUrl === data.mainImageUrl)
    ) {
      form.images.unshift({
        imageUrl: data.mainImageUrl,
        imageType: 1,
        sortOrder: 0
      });
    }
    const primaryIndex = form.images.findIndex(
      image => image.imageUrl === data.mainImageUrl
    );
    if (primaryIndex > 0)
      form.images.unshift(...form.images.splice(primaryIndex, 1));
    dialog.value = true;
    void loadTemplate();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  }
}
async function save() {
  if (specificationsLoading.value) {
    ElMessage.warning("请等待销售属性值加载完成");
    return;
  }
  if (!specificationsLocked.value && specificationsDirty.value) {
    ElMessage.warning(
      "请完成销售属性选择并生成SKU，再调整排序或删除不存在的规格"
    );
    return;
  }
  if (imagesUploading.value) {
    ElMessage.warning("请等待图片上传完成");
    return;
  }
  if (templateLoading.value || templateError.value) {
    ElMessage.warning("请等待分类属性配置加载完成，失败时请重试");
    return;
  }
  if (form.images.some(image => !image.imageUrl.trim())) {
    ElMessage.warning("请填写每张图片的地址");
    return;
  }
  if (
    form.images.length &&
    !form.images.some(image => image.imageUrl === form.mainImageUrl)
  ) {
    ElMessage.warning("请从照片墙中选择默认主图");
    return;
  }
  if (
    new Set(form.images.map(image => image.imageUrl.trim())).size !==
    form.images.length
  ) {
    ElMessage.warning("请勿添加重复的图片地址");
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
    if (form.productId && detail.value?.status === 1)
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
        <el-form-item label="商品类别">
          <el-cascader
            v-model="filters.categoryId"
            :options="categoryTree"
            :props="{ emitPath: false }"
            placeholder="全部商品类别"
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
        <p>维护 SPU 商品资料与销售状态</p>
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
        商品类别或品牌加载失败：{{ optionError }}
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
        <el-table-column label="商品" min-width="150" align="center">
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
        <el-table-column
          prop="categoryName"
          label="商品类别"
          min-width="120"
          align="center"
        />
        <el-table-column
          prop="brandName"
          label="品牌"
          min-width="80"
          align="center"
        />
        <el-table-column
          prop="description"
          label="商品描述"
          min-width="250"
          align="center"
          :show-overflow-tooltip="{ popperStyle: { maxWidth: '500px' } }"
        />
        <el-table-column
          prop="skuCount"
          label="SKU 数量"
          width="100"
          align="center"
        />
        <el-table-column label="状态" width="100" align="center"
          ><template #default="{ row }"
            ><el-tag :type="tagTypes[row.status]">{{
              statuses[row.status]
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="更新时间" min-width="180" align="center"
          ><template #default="{ row }">{{
            formatDateTime(row.updateTime)
          }}</template></el-table-column
        >
        <el-table-column
          label="操作"
          fixed="right"
          min-width="180"
          align="center"
        >
          <template #default="{ row }">
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
      width="min(1200px, 94vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!saving"
      :show-close="!saving"
      destroy-on-close
    >
      <el-alert
        v-if="!form.productId"
        title="新商品保存为草稿；可在此配置销售属性、生成并调整 SKU，确认后手动保存。"
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
            ><el-form-item label="商品类别" prop="categoryId">
              <el-cascader
                v-model="form.categoryId"
                :disabled="!!form.productId"
                :options="enabledCategoryTree"
                :props="{ emitPath: false }"
                filterable
                placeholder="请选择商品类别"
                class="full-width"
                style="width: 100%"
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
            ><el-form-item label="商品编码" prop="productCode"
              ><el-input
                v-model="form.productCode"
                :disabled="detail?.status === 1"
                maxlength="64" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="商品名称" prop="name"
              ><el-input v-model="form.name" maxlength="255" /></el-form-item
          ></el-col>
          <el-col :span="12"
            ><el-form-item label="销售规格"
              ><el-input
                v-model="form.productUnit"
                maxlength="32"
                placeholder="件 / 箱 / 千克" /></el-form-item
          ></el-col>
        </el-row>
        <el-form-item label="商品描述"
          ><el-input v-model="form.description" type="textarea" :rows="3"
        /></el-form-item>

        <el-alert
          v-if="templateError"
          :title="templateError"
          type="error"
          :closable="false"
        />
        <el-button v-if="templateError" @click="loadTemplate"
          >重新加载配置</el-button
        >
        <el-divider content-position="left">普通参数</el-divider>
        <ProductParameters
          v-model="form.attributes"
          :options="parameterOptions"
          :disabled="readonly || saving || templateLoading || !!templateError"
        />
        <el-divider content-position="left">销售属性与 SKU</el-divider>
        <el-alert
          v-if="detail?.status === 1 && !readonly"
          title="已上架商品需先下架，才能修改销售属性和 SKU 组合。"
          type="info"
          :closable="false"
        />
        <div v-loading="templateLoading">
          <ProductSpecifications
            v-if="!templateLoading && !templateError"
            :key="editorKey + '-' + String(form.categoryId)"
            :options="salesOptions"
            :selections="form.salesAttributes"
            :skus="form.skus"
            :known-skus="
              (detail?.skus ?? []).map(item => ({
                ...item.sku,
                images: item.images ?? []
              }))
            "
            :product-code="form.productCode"
            :disabled="specificationsLocked"
            @changed="form.salesAttributes = $event"
            @dirty="specificationsDirty = $event"
            @loading="specificationsLoading = $event"
            @generated="generated"
            @recoded="form.skus = $event"
          />
          <ProductSkuTable
            v-if="form.skus.length"
            v-model="form.skus"
            :disabled="specificationsLocked || specificationsDirty"
          />
        </div>
        <el-divider content-position="left">商品图片</el-divider>
        <ProductImages
          v-model="form.images"
          v-model:main-image-url="form.mainImageUrl"
          :disabled="readonly || saving"
          @uploading="imagesUploading = $event"
        />
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="dialog = false">{{
          readonly ? "关闭" : "取消"
        }}</el-button
        ><el-button
          v-if="!readonly"
          type="primary"
          :loading="saving"
          :disabled="
            imagesUploading || specificationsLoading || templateLoading
          "
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

.page-heading p {
  margin: 0;
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
  justify-content: center;
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
</style>
