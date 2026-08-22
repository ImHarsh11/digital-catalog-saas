import { api } from './api';
import type {
  ProductCreateInput,
  ProductDetail,
  ProductImageUploadResponse,
  ProductListItem,
  ProductStatus,
  ProductUpdateInput,
} from '@/types/product';

export interface ProductFilters {
  categoryId?: number;
  status?: ProductStatus;
  search?: string;
}

export async function listProducts(shopId: number, filters: ProductFilters = {}): Promise<ProductListItem[]> {
  const params: Record<string, string> = {};
  if (filters.categoryId) params.category_id = String(filters.categoryId);
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;
  const { data } = await api.get<ProductListItem[]>(`/api/shops/${shopId}/products`, { params });
  return data;
}

export async function getProduct(shopId: number, productId: number): Promise<ProductDetail> {
  const { data } = await api.get<ProductDetail>(`/api/shops/${shopId}/products/${productId}`);
  return data;
}

export async function createProduct(shopId: number, payload: ProductCreateInput): Promise<ProductDetail> {
  const { data } = await api.post<ProductDetail>(`/api/shops/${shopId}/products`, payload);
  return data;
}

export async function updateProduct(
  shopId: number,
  productId: number,
  payload: ProductUpdateInput,
): Promise<ProductDetail> {
  const { data } = await api.put<ProductDetail>(`/api/shops/${shopId}/products/${productId}`, payload);
  return data;
}

export async function setProductStatus(
  shopId: number,
  productId: number,
  status: ProductStatus,
): Promise<ProductDetail> {
  const { data } = await api.patch<ProductDetail>(`/api/shops/${shopId}/products/${productId}/status`, {
    status,
  });
  return data;
}

export async function deleteProduct(shopId: number, productId: number): Promise<void> {
  await api.delete(`/api/shops/${shopId}/products/${productId}`);
}

export async function uploadProductImage(
  shopId: number,
  productId: number,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ProductImageUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<ProductImageUploadResponse>(
    `/api/shops/${shopId}/products/${productId}/images`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    },
  );
  return data;
}

export async function deleteProductImage(shopId: number, productId: number, imageId: number): Promise<void> {
  await api.delete(`/api/shops/${shopId}/products/${productId}/images/${imageId}`);
}

export async function setPrimaryImage(
  shopId: number,
  productId: number,
  imageId: number,
): Promise<ProductDetail> {
  const { data } = await api.patch<ProductDetail>(
    `/api/shops/${shopId}/products/${productId}/images/${imageId}/primary`,
  );
  return data;
}
