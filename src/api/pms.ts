import { http } from "@/utils/http";
import type { PageResult, Result } from "./tms";

// Long identifiers may be serialized as strings by the backend.
export type Id = string | number;
export interface Category {
  catId: Id;
  name: string;
  parentCid: Id;
  showStatus: number;
  productUnit?: string;
}
export interface Brand {
  brandId: Id;
  name: string;
  status: number;
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
  status: number;
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
  updatedAt?: number;
  attributes?: ProductAttribute[];
  images?: ProductImage[];
  skus?: SkuDetail[];
}
export interface ProductCommand {
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
  images: (Omit<ProductImage, "imageType"> & { imageType: string })[];
  salesAttributes: { attributeId: Id; valueIds: Id[]; sortOrder: number }[];
  skus: (Omit<Sku, "status"> & { status: string; images: SkuImage[] })[];
  skuDefaults?: {
    retailPrice: number;
    currencyCode: string;
    weightKg?: number;
  };
}
export async function pmsRequest<T>(
  method: "get" | "post",
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
