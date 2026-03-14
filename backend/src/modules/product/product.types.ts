export interface ProductResponse {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  totalStock: number;
  availableStock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  totalStock: number;
}

export interface ProductFilter {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder: "asc" | "desc";
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}
