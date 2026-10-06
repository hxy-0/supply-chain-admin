import { http } from "@/utils/http";
import type { PageResult, Result } from "./tms";

// Long identifiers may be serialized as strings by the backend.
export type Id = string | number;
export interface Category {
  catId: Id;
  name: string;
  parentCid: Id;
  isShow: number;
  productUnit?: string;
  catLevel?: number;
  sort?: number;
  icon?: string;
}
export interface Brand {
  brandId: Id;
  name: string;
  isEnable: number;
  englishName?: string;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  sortOrder?: number;
  createUser?: string;
  createTime?: number;
  updateUser?: string;
  updateTime?: number;
  creatorName?: string;
  updaterName?: string;
}
export interface ProductAttribute {
  attributeId: Id;
  attributeName?: string;
  attributeValueId?: Id;
  attributeValueName?: string;
  customValue?: string;
  sortOrder?: number;
}
export interface ProductImage {
  imageUrl: string;
  imageType: number;
  sortOrder?: number;
}
export interface SkuImage {
  imageUrl: string;
  isPrimary?: boolean;
  sortOrder?: number;
}
export interface Sku {
  version?: number;
  skuId?: Id;
  specSignature: string;
  specText?: string;
  skuCode?: string;
  barcode?: string;
  name?: string;
  retailPrice: number;
  currencyCode: string;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  /** 1=启用 0=停用（P3C is_enable） */
  isEnable: number;
  isDefault?: boolean;
  sortOrder?: number;
}
export interface SkuDetail {
  sku: Sku;
  attributes: {
    attributeId: Id;
    attributeValueId: Id;
    attributeName?: string;
    attributeValueName?: string;
  }[];
  images: SkuImage[];
}
export interface Product {
  version?: number;
  productId: Id;
  productCode: string;
  name: string;
  subtitle?: string;
  categoryId: Id;
  categoryName?: string;
  brandId?: Id;
  brandName?: string;
  productUnit?: string;
  mainImageUrl?: string;
  description?: string;
  sortOrder?: number;
  status: number;
  skuCount?: number;
  updateTime?: number;
  attributes?: ProductAttribute[];
  images?: ProductImage[];
  skus?: SkuDetail[];
}
export interface ProductCommand {
  version?: number;
  productId?: Id;
  productCode: string;
  name: string;
  subtitle?: string;
  categoryId?: Id;
  brandId?: Id;
  productUnit?: string;
  mainImageUrl?: string;
  description?: string;
  sortOrder?: number;
  attributes: ProductAttribute[];
  images: ProductImage[];
  salesAttributes: { attributeId: Id; valueIds: Id[]; sortOrder: number }[];
  skus: (Sku & { images: SkuImage[] })[];
  skuDefaults?: {
    retailPrice: number;
    currencyCode: string;
    weightKg?: number;
  };
}
export async function pmsRequest<T>(
  method: "get" | "post" | "delete" | "patch",
  path: string,
  data?: object,
  params?: object
): Promise<T> {
  const result = await http.request<Result<T>>(method, `/api${path}`, {
    data,
    params
  });
  if (result.code !== 0) throw new Error(result.message || "操作失败");
  return result.data;
}
export const getProducts = (params: object) =>
  pmsRequest<PageResult<Product>>("get", "/products", undefined, params);
export const getProduct = (id: Id) =>
  pmsRequest<Product>("get", `/products/${id}`);
export const saveProduct = (data: ProductCommand) =>
  pmsRequest<Product>("post", "/products", data);
export const changeProductStatus = (
  id: Id,
  action: "publish" | "unpublish" | "archive"
) => pmsRequest<Product>("post", `/products/${id}/${action}`);
export const getCategories = () =>
  pmsRequest<Category[]>("get", "/categories/all");
export async function getBrands(): Promise<Brand[]> {
  const brands: Brand[] = [];
  let pageNum = 1;
  while (true) {
    const page = await pmsRequest<PageResult<Brand>>(
      "get",
      "/brands",
      undefined,
      { pageNum, pageSize: 100 }
    );
    brands.push(...page.records);
    if (!page.records.length || brands.length >= page.total) return brands;
    pageNum++;
  }
}

export interface Attribute {
  attributeId: Id;
  attributeCode: string;
  name: string;
  inputType: number;
  unit?: string;
  isEnable: number;
}
export interface AttributeValue {
  attributeValueId: Id;
  attributeId: Id;
  valueCode: string;
  valueName: string;
  sortOrder: number;
  isEnable: number;
}
export interface CategoryAttribute extends Attribute {
  attributeKind: number;
  required: boolean;
  searchable: boolean;
  sortOrder: number;
}
export const getAttributes = (params: object) =>
  pmsRequest<PageResult<Attribute>>("get", "/attributes", undefined, params);
export async function getEnabledAttributes(): Promise<Attribute[]> {
  const result: Attribute[] = [];
  for (let pageNum = 1; ; pageNum++) {
    const page = await getAttributes({ pageNum, pageSize: 100, isEnable: 1 });
    result.push(...page.records);
    if (!page.records.length || result.length >= Number(page.total))
      return result;
  }
}
export const getAttributeValues = (id: Id) =>
  pmsRequest<AttributeValue[]>("get", `/attributes/${id}/values`);
export const getCategoryAttributes = (id: Id) =>
  pmsRequest<CategoryAttribute[]>("get", `/categories/${id}/attributes`);
export const saveCategoryAttributes = (
  id: Id,
  items: CategoryAttribute[],
  expectedItems?: CategoryAttribute[]
) =>
  pmsRequest<CategoryAttribute[]>("post", `/categories/${id}/attributes`, {
    items,
    expectedItems
  });

export async function uploadProductImage(file: File): Promise<string> {
  const data = new FormData();
  data.append("file", file);
  const result = await http.request<Result<{ url: string }>>(
    "post",
    "/api/product-images",
    {
      data,
      headers: { "Content-Type": "multipart/form-data" }
    }
  );
  if (result.code !== 0) throw new Error(result.message || "图片上传失败");
  return result.data.url;
}
