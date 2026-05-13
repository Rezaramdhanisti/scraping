export interface ShopeeSearchItemsResponse {
  bff_meta: any;
  error: any;
  error_msg: any;
  reserved_keyword: any;
  suggestion_algorithm: any;
  algorithm: any;
  total_count: number;
  nomore: boolean;
  items: Item[];
  price_adjust: any;
  adjust: Adjust;
  total_ads_count: number;
  hint_keywords: any;
  show_disclaimer: boolean;
  json_data: string;
  query_rewrite: QueryRewrite;
  disclaimer_infos: any[];
  need_next_search: boolean;
  low_result: any;
  autoplay_info: any;
  food_item_info: FoodItemInfo;
  search_tracking: string;
  search_sessionid: string;
  batch_size: number;
  search_item_bff_tracking: string;
  user_info: UserInfo;
  request_id: string;
  cached_result: any;
  experiments: Experiment[];
  item_extra_config: string;
  config: Config;
  live_stream: any;
  ymal_items: any;
  uff_cat_ids: any;
  is_auto_part_intention: boolean;
  card_set: any;
  ads_data_tms: string;
  srp_component_info: SrpComponentInfo;
  user_address: any;
  shop_result_info: ShopResultInfo;
  performance: Performance;
  ui_info: UiInfo;
  union_experiment_info: any;
  landing_page_info: LandingPageInfo;
  debug_info: DebugInfo;
}

export interface Item {
  item_basic: ItemBasic;
  adsid: any;
  campaignid: any;
  distance: any;
  match_type: any;
  ads_keyword: any;
  deduction_info: any;
  collection_id: any;
  display_name: any;
  campaign_stock: any;
  json_data: string;
  tracking_info: TrackingInfo;
  itemid: number;
  shopid: number;
  algo_image: any;
  fe_flags: any;
  item_type: number;
  foody_item: any;
  search_item_tracking: string;
  bff_item_tracking: string;
  personalized_labels: any;
  biz_json: string;
  creative_image_id: any;
  creative_id: any;
  creative_id_int: any;
  item_card_label_groups: any;
  title_max_lines: any;
  play_icon_ui_type: number;
  item_card_bottom_element: any;
  video_card: VideoCard;
  live_card: any;
  item_card_element_collection: any;
  item_card_price: any;
  display_ad_tag: any;
  traffic_source: number;
  live_card_item: any;
  live_card_rcmd_label: any;
  item_card_displayed_asset: any;
  item_data: any;
  ads_data_tms: string;
  item_config: ItemConfig;
  ctx_item_type: number;
  real_items: any;
  v_model_id: any;
  video_card_item: any;
  shop: any;
  creator: any;
  ad_voucher_signature: any;
  ui_info: any;
  debug_info: any;
}

export interface ItemBasic {
  itemid: number;
  shopid: number;
  name: string;
  label_ids: number[];
  image: string;
  images: string[];
  currency: string;
  stock: any;
  status: number;
  ctime: number;
  sold: any;
  historical_sold: any;
  liked: boolean;
  liked_count: number;
  view_count: any;
  catid: number;
  brand: string;
  cmt_count: number;
  flag: number;
  cb_option: number;
  item_status: string;
  price: number;
  price_min: number;
  price_max: number;
  price_min_before_discount: number;
  price_max_before_discount: number;
  hidden_price_display: any;
  price_before_discount: number;
  has_lowest_price_guarantee: boolean;
  show_discount: number;
  raw_discount: number;
  discount?: string;
  is_category_failed: any;
  size_chart: any;
  video_info_list?: VideoInfoList[];
  tier_variations: TierVariation[];
  item_rating: ItemRating;
  item_type: number;
  reference_item_id: string;
  transparent_background_image: string;
  is_adult: boolean;
  badge_icon_type: any;
  shopee_verified: boolean;
  is_official_shop: boolean;
  show_official_shop_label: boolean;
  show_shopee_verified_label: boolean;
  show_official_shop_label_in_title: any;
  is_cc_installment_payment_eligible: boolean;
  is_non_cc_installment_payment_eligible: boolean;
  coin_earn_label: any;
  show_free_shipping: boolean;
  preview_info: any;
  coin_info: any;
  exclusive_price_info: any;
  bundle_deal_id: any;
  can_use_bundle_deal: any;
  bundle_deal_info?: BundleDealInfo;
  is_group_buy_item: any;
  has_group_buy_stock: any;
  group_buy_info: any;
  welcome_package_type: number;
  welcome_package_info: any;
  add_on_deal_info?: AddOnDealInfo;
  can_use_wholesale: boolean;
  is_preferred_plus_seller: boolean;
  shop_location: string;
  has_model_with_available_shopee_stock: any;
  voucher_info: any;
  can_use_cod: boolean;
  is_on_flash_sale: boolean;
  spl_installment_tenure?: number;
  is_live_streaming_price: any;
  is_mart: boolean;
  pack_size: any;
  deep_discount_skin: any;
  is_service_by_shopee: boolean;
  spl_repayment_label_repayment?: string;
  spl_repayment_label_text?: string;
  highlight_video: any;
  free_shipping_info?: FreeShippingInfo;
  global_sold_count: any;
  wp_eligibility: any;
  live_streaming_info: any;
  non_wifi_highlight_video: any;
  dynamic_ui_flag: any;
  estimated_delivery_time: any;
  adult_age_threshold: any;
  need_kyc: boolean;
  adult_types: any;
  item_card_display_price: ItemCardDisplayPrice;
  item_card_display_label?: ItemCardDisplayLabel;
  model_id: any;
  is_shopee_choice: boolean;
  item_card_display_sold_count: any;
  spl_installment_discount?: SplInstallmentDiscount;
  item_card_hidden_field: any;
  compatible_with_user_vehicle: boolean;
  item_card_display_overlay: any;
  shop_name: string;
  shop_icon: any;
  is_lowest_price: boolean;
  name_tr: any;
  shop_location_tr: any;
}

export interface VideoInfoList {
  video_id: string;
  thumb_url: string;
  duration: number;
  version: number;
  vid: string;
  formats: Format[];
  default_format: DefaultFormat;
  mms_data: any;
}

export interface Format {
  format: number;
  defn: string;
  profile: string;
  path: string;
  url: string;
  width: number;
  height: number;
}

export interface DefaultFormat {
  format: number;
  defn: string;
  profile: string;
  path: string;
  url: string;
  width: number;
  height: number;
}

export interface TierVariation {
  name: string;
  options: string[];
  images?: string[];
  properties: any[];
  type: number;
}

export interface ItemRating {
  rating_star: number;
  rating_count: number[];
  rcount_with_context: number;
  rcount_with_image: number;
}

export interface BundleDealInfo {
  bundle_deal_id: number;
  bundle_deal_label: string;
}

export interface AddOnDealInfo {
  add_on_deal_id: number;
  add_on_deal_label: string;
  sub_type: number;
  status: number;
}

export interface FreeShippingInfo {
  type: number;
  image_hash: string;
  image_height: number;
  image_width: number;
}

export interface ItemCardDisplayPrice {
  promotion_type: number;
  promotion_id: number;
  price: number;
  strikethrough_price?: number;
  discount: number;
  hidden_price_display_text: any;
  recommended_shop_voucher_promotion_id?: number;
  discount_text?: string;
  model_id: number;
  recommended_platform_voucher_promotion_id: any;
  recommended_shop_voucher_info?: RecommendedShopVoucherInfo;
  recommended_platform_voucher_info: any;
  original_price: number;
}

export interface RecommendedShopVoucherInfo {
  promotion_id: number;
  voucher_code: string;
  voucher_discount: number;
  time_info: TimeInfo;
  groups: any[];
  min_spend: number;
}

export interface TimeInfo {
  start_time: number;
  end_time: number;
  valid_duration: any;
}

export interface ItemCardDisplayLabel {
  label_type: number;
  exclusive_price_result: any;
  deep_discount_skin: any;
}

export interface SplInstallmentDiscount {
  card_promo_title_text: string;
  card_promo_sub_title_text: string;
}

export interface TrackingInfo {
  viral_spu_tracking: any;
  business_tracking: any;
  multi_search_tracking: any;
  groupid: any;
  ruleid: number[];
}

export interface VideoCard {
  video_id: any;
  title: any;
  cover: any;
  view_count: any;
  author_nickname: any;
  author_avatar: any;
  mms_data: any;
  landing_data: any;
  landing_path: any;
  landing_path_item: any;
  landing_params: any;
  landing_params_item: any;
  video_creator_id: number;
  unique_id: any;
}

export interface ItemConfig {
  disable_model_id_to_pdp: boolean;
  disable_image_to_pdp: boolean;
}

export interface Adjust {
  count: any;
}

export interface QueryRewrite {
  fe_query_write_status: number;
  rewrite_keyword: any;
  hint_keywords: any;
  ori_keyword: string;
  ori_total_count: number;
  rewrite_type: any;
}

export interface FoodItemInfo {
  total_count: number;
}

export interface UserInfo {
  user_type: number[];
  is_affiliate: boolean;
}

export interface Experiment {
  key: string;
  value: string;
}

export interface Config {
  highlight_video_delay_ms: number;
  image_ui_type: number;
}

export interface SrpComponentInfo {
  show_ai_chat_entry: boolean;
  buy_together_card_count_per_page: number;
  buy_together_card_meta_info: any;
}

export interface ShopResultInfo {
  total_count: any;
  algorithm: any;
  search_tracking: string;
  creator_search_tracking: string;
}

export interface Performance {
  request_id: string;
  request_pack_size: number;
  response_pack_size: number;
  server_cost: number;
  be_performance_info: string;
}

export interface UiInfo {
  card_display_layout_type: number;
  cover_image_ratio_type: any;
  dynamic_translation_status: number;
}

export interface LandingPageInfo {
  buy_together_landing_page_meta_info: any;
}

export interface DebugInfo {
  fallback: string;
}
