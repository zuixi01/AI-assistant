export interface DoudianProduct {
  productId: string;
  title: string;
  category?: string | null;
  price?: number | null;
  stock?: number | null;
  status?: string | null;
  imageUrl?: string | null;
  detailUrl?: string | null;
}

export interface DoudianConnector {
  getProducts(shop: { shopId: string; accessToken: string }): Promise<{ items: DoudianProduct[] }>;
}
