export interface ShopeeShopProductRequest {
  domain: string;
  shop_id: number;
  max_page?: number
  products_per_page?: number;
  get_next_page?: boolean;
  max_results?: number
}
export interface ShopItemsRequest {
  domain: string;
  shopItemIds: ShopItemId[];
}
export interface ShopItemId {
  shop_id: number;
  item_id: number;
}
export interface URLsRequest {
  url: string;
  step_id: string;
  priority: number;
}

export interface URLsRequestTiktok {
  poi_id: string;
  language: string;
  country: string;
  check_in: string;
  check_out: string;
  adults: string;
  request_timestamp: string;
  cookie_id?: string;
}
export interface TestCookieTiktokRequest {
  cookie: string;
}

export interface TiktokShopSearchProductsRequest {
  keyword: string;
  country_code: string;
  end_product_rating: string;
  start_product_rating: string;
  limit: string;
  page: string;
  shop_key_word: string;
}

export interface ShopeeBatchBodyRequest {
  url: string;
}

export interface ShopeeResult {
  ip: string;
  proxy_id: number;
  result: JSON;
}

export interface ShopeeSyncBodyRequest {
  url: string;
}
export interface ShopeeProxyConfig {
  provider: string;
  hostname: string;
  port: number;
  username: string;
  password: string;
  weight: number;
}
