export interface ShopeeBatchBodyRequest {
  urls: string[];
}

export interface ShopeeSyncBodyRequest {
  url: string;
}

export interface ShopeeApiResponse<Data> {
  bff_meta: any;
  error: any;
  error_msg: any;
  data: Data | null;
}

export interface GetListData {
  items: GetListItem[];
}

export interface GetListItem {
  itemid: number;
  shopid: number;
  name: string;
  label_ids: number[];
  image: string;
  images: string[];
  currency: string;
  stock: number;
  status: number;
  ctime: number;
  sold: number;
  historical_sold: number;
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
  discount: string;
  is_category_failed: any;
  size_chart: string;
  video_info_list: VideoInfoList[];
  tier_variations: TierVariation[];
  item_rating: ItemRating;
  item_type: number;
  reference_item_id: string;
  transparent_background_image: string;
  is_adult: boolean;
  badge_icon_type: number;
  shopee_verified: boolean;
  is_official_shop: boolean;
  show_official_shop_label: boolean;
  show_shopee_verified_label: boolean;
  show_official_shop_label_in_title: boolean;
  is_cc_installment_payment_eligible: boolean;
  is_non_cc_installment_payment_eligible: boolean;
  coin_earn_label: any;
  show_free_shipping: boolean;
  preview_info: any;
  coin_info: any;
  exclusive_price_info: any;
  bundle_deal_id: number;
  can_use_bundle_deal: boolean;
  bundle_deal_info: any;
  is_group_buy_item: any;
  has_group_buy_stock: any;
  group_buy_info: any;
  welcome_package_type: number;
  welcome_package_info: any;
  add_on_deal_info: any;
  can_use_wholesale: boolean;
  is_preferred_plus_seller: boolean;
  shop_location: string;
  has_model_with_available_shopee_stock: boolean;
  voucher_info: VoucherInfo;
  can_use_cod: boolean;
  is_on_flash_sale: boolean;
  spl_installment_tenure: any;
  is_live_streaming_price: any;
  is_mart: boolean;
  pack_size: any;
  shop_name: string;
  shop_rating: number;
  deep_discount_skin: any;
  is_service_by_shopee: boolean;
  platform_voucher: any;
  wp_eligibility: any;
  free_shipping_info: any;
  global_sold_count: number;
  item_card_display_price: ItemCardDisplayPrice;
  item_card_display_label: ItemCardDisplayLabel;
  is_shopee_choice: boolean;
  item_card_hidden_field: any;
  item_card_display_overlay: any;
}

export interface VideoInfoList {
  video_id: string;
  thumb_url: string;
  duration: number;
  version: number;
  vid: string;
  formats: Format[];
  default_format: DefaultFormat;
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

export interface ItemRating {
  rating_star: number;
  rating_count: number[];
  rcount_with_context: number;
  rcount_with_image: number;
}

export interface VoucherInfo {
  promotion_id: number;
  voucher_code: string;
  label: string;
}

export interface ItemCardDisplayPrice {
  item_id: number;
  model_id: number;
  promotion_type: number;
  promotion_id: number;
  price: number;
  strikethrough_price: number;
  discount: number;
  discount_text: string;
}

export interface ItemCardDisplayLabel {
  item_id: number;
  model_id: number;
  promotion_type: number;
  promotion_id: number;
  label_type: number;
  is_teaser: boolean;
  exclusive_price_result: any;
  deep_discount_skin: any;
  flash_sale_info: FlashSaleInfo;
}

export interface FlashSaleInfo {
  flash_sale_design_type: number;
  flash_sale_sold_count: number;
  flash_sale_stock: number;
  flash_sale_sold_percentage: number;
  flash_sale_start_time: number;
  flash_sale_end_time: number;
}

export interface GetPcData {
  item: Item;
  account: Account;
  product_images: ProductImages;
  product_price: ProductPrice2;
  flash_sale: any;
  flash_sale_preview: any;
  deep_discount: any;
  exclusive_price: any;
  exclusive_price_cta: any;
  product_meta: ProductMeta;
  product_review: ProductReview;
  promotion_info: PromotionInfo2;
  age_gate: AgeGate;
  shipping_meta: any;
  product_shipping: ProductShipping;
  shop_vouchers: ShopVoucher2[];
  free_return: any;
  coin_info: CoinInfo;
  product_attributes: ProductAttributes;
  shop_detailed: ShopDetailed;
  age_gate_control: any;
  abnormal_popup: any;
  return_on_spot: any;
  display_sections: DisplaySections;
  ineligible_ep: any;
  tax_disclaimer: any;
  alcohol_disclaimer: any;
  design_control: DesignControl;
  shopee_free_return: any;
  detail_level: number;
  removed_fields: any;
  size_guide: any;
  designer_info: any;
  shipping_info: any;
  vehicle_compatibility_info: any;
  nea: any;
  button_group: ButtonGroup2;
  installment_drawer: InstallmentDrawer;
  ongoing_banner: any;
  teaser_banner: any;
  price_breakdown: PriceBreakdown2;
  membership_exclusive: any;
  membership_exclusive_teaser: any;
  service_entrance: ServiceEntrance;
  service_drawer: ServiceDrawer;
  trade_in: any;
  product_description: ProductDescription;
  selected_tiers: any;
  size_info: any;
  size_recommendation: any;
}

export interface Item {
  item_id: number;
  shop_id: number;
  item_status: string;
  status: number;
  item_type: number;
  reference_item_id: string;
  title: string;
  image: string;
  label_ids: number[];
  is_adult: boolean;
  is_preview: boolean;
  flag: number;
  is_service_by_shopee: boolean;
  condition: number;
  cat_id: number;
  has_low_fulfillment_rate: boolean;
  is_live_streaming_price: any;
  currency: string;
  brand: string;
  brand_id: number;
  show_discount: number;
  ctime: number;
  item_rating: ItemRating;
  cb_option: number;
  has_model_with_available_shopee_stock: boolean;
  shop_location: string;
  attributes: Attribute[];
  rich_text_description: RichTextDescription;
  invoice_option: any;
  is_category_failed: any;
  is_prescription_item: boolean;
  preview_info: any;
  show_prescription_feed: boolean;
  is_alcohol_product: boolean;
  is_infant_milk_formula_product: boolean;
  is_unavailable: boolean;
  is_partial_fulfilled: boolean;
  is_presale: boolean;
  is_presale_deposit_item: any;
  is_presale_deposit_made: any;
  description: string;
  categories: Category[];
  fe_categories: FeCategory[];
  item_has_video: boolean;
  presale_dday_start_time: any;
  is_lowest_price_at_shopee: any;
  display_description_disclosure_rsku_redirection: any;
  display_similar_sold: any;
  title_type: number;
  models: Model[];
  tier_variations: TierVariation[];
  size_chart: any;
  size_chart_info: any;
  welcome_package_type: number;
  is_free_gift: boolean;
  deep_discount: any;
  is_low_price_eligible: any;
  bundle_deal_info: any;
  add_on_deal_info: any;
  shipping_icon_type: number;
  badge_icon_type: number;
  spl_info: SplInfo;
  estimated_days: number;
  is_pre_order: boolean;
  is_free_shipping: boolean;
  overall_purchase_limit: any;
  min_purchase_limit: number;
  is_hide_stock: boolean;
  stock: any;
  normal_stock: any;
  current_promotion_reserved_stock: number;
  can_use_wholesale: boolean;
  wholesale_tier_list: any[];
  price: number;
  raw_discount: number;
  hidden_price_display: any;
  price_min: number;
  price_max: number;
  price_before_discount: number;
  price_min_before_discount: number;
  price_max_before_discount: number;
  other_stock: number;
  discount_stock: any;
  current_promotion_has_reserve_stock: boolean;
  complaint_policy: any;
  show_recycling_info: any;
  should_show_amp_tag: boolean;
  all_models_has_pre_order: boolean;
  is_item_inherited: boolean;
  max_quantity: number;
  selected_real_models: any;
  size_tier_variation_idx: any;
  title_tr: any;
  description_tr: any;
  rich_text_description_tr: any;
}

export interface ItemRating {
  rating_star: number;
}

export interface Attribute {
  name: string;
  value: string;
  id: number;
  is_timestamp: boolean;
  brand_option: any;
  val_id: number;
  url: any;
  brand_id: any;
  full_url: any;
  type: any;
}

export interface RichTextDescription {
  paragraph_list: ParagraphList[];
}

export interface ParagraphList {
  type: number;
  text?: string;
  img_id?: string;
  ratio?: number;
  empty_paragraph_count?: number;
}

export interface Category {
  catid: number;
  display_name: string;
  no_sub: boolean;
  is_default_subcat: boolean;
}

export interface FeCategory {
  catid: number;
  display_name: string;
  no_sub: boolean;
  is_default_subcat: boolean;
}

export interface Model {
  item_id: number;
  status: number;
  current_promotion_reserved_stock: any;
  name: string;
  promotion_id: number;
  price: number;
  price_stocks: PriceStock[];
  current_promotion_has_reserve_stock: boolean;
  normal_stock: any;
  extinfo: Extinfo;
  price_before_discount: number;
  model_id: number;
  stock: any;
  has_gimmick_tag: boolean;
  key_measurement: any;
  sold: any;
  is_lowest_price_at_shopee: boolean;
  name_tr: any;
  select_variation_response: SelectVariationResponse;
}

export interface PriceStock {
  allocated_stock?: number;
  stock_breakdown_by_location?: StockBreakdownByLocation[];
  promotion_type: number;
}

export interface StockBreakdownByLocation {
  location_id: string;
  available_stock: any;
  fulfilment_type: number;
  address_id: number;
  allocated_stock: any;
}

export interface Extinfo {
  tier_index: number[];
  is_pre_order: boolean;
  estimated_days: number;
}

export interface SelectVariationResponse {
  bff_meta: any;
  error: any;
  error_msg: any;
  data: Data2;
}

export interface Data2 {
  product_price: ProductPrice;
  stock: any;
  selected_variation: SelectedVariation;
  promotion_info: PromotionInfo;
  button_group: ButtonGroup;
  ongoing_banner: any;
  teaser_banner: any;
  price_breakdown: PriceBreakdown;
  tier_variation_display_indicators: TierVariationDisplayIndicator[];
  max_quantity: number;
  product_shipping: any;
}

export interface ProductPrice {
  discount: number;
  installment_info: any;
  spl_installment_info: any;
  pack_size: string;
  hide_price: boolean;
  price: Price;
  price_before_discount: PriceBeforeDiscount;
  presale_price: any;
  lowest_past_price: any;
  labels: any;
  hide_discount: boolean;
  discount_text: any;
  show_final_price_indicator: boolean;
  final_price_vouchers: FinalPriceVoucher[];
  has_final_price: boolean;
}

export interface Price {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface PriceBeforeDiscount {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface FinalPriceVoucher {
  promotion_id: number;
  voucher_code: string;
  is_auto_claimed_just_now: boolean;
  groups: any;
}

export interface SelectedVariation {
  reminder_text: any[];
  promotion_labels: PromotionLabels;
  max_quantity: number;
}

export interface PromotionLabels {
  is_live_streaming_ongoing: any;
  live_streaming_promotion_type: any;
  wholesale_text: any;
  pre_order_text: string;
  wholesale_label: any;
}

export interface PromotionInfo {
  spl: any;
  spl_lite: any;
  installment: any;
  wholesale: any;
  insurance: any;
  item_installment_eligibility: any;
}

export interface ButtonGroup {
  buy_with_voucher: any;
}

export interface PriceBreakdown {
  price: Price2;
  price_before_discount: PriceBeforeDiscount2;
  discount_breakdown: DiscountBreakdown[];
}

export interface Price2 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface PriceBeforeDiscount2 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface DiscountBreakdown {
  type: number;
  price_source: string;
  discount_amount: number;
  exclusive_price: any;
  shop_voucher?: ShopVoucher;
  platform_voucher: any;
}

export interface ShopVoucher {
  min_spend: number;
  discount_type: number;
  discount_value: any;
  discount_percentage: string;
}

export interface TierVariationDisplayIndicator {
  title: string;
  options: Option[];
  title_tr: any;
}

export interface Option {
  name: string;
  image: string;
  display_indicator: number;
  name_tr: any;
}

export interface TierVariation {
  name: string;
  options: string[];
  images: string[];
  properties: any;
  type: number;
  summed_stocks: any;
  display_indicators: number[];
  name_tr: any;
  options_tr: any;
}

export interface SplInfo {
  installment_info: any;
  user_credit_info: any;
  channel_id: any;
  show_spl: boolean;
  show_spl_lite: any;
  spl_xtra: any;
  spl_motorcycle_loan: any;
}

export interface Account {
  user_id: any;
  is_new_user: any;
  default_address: DefaultAddress;
  adult_consent: any;
  birth_timestamp: any;
}

export interface DefaultAddress {
  state: string;
  city: string;
  district: string;
  town: string;
  zip_code: string;
  address: any;
  region: any;
  longitude: any;
  latitude: any;
}

export interface ProductImages {
  video: any;
  images: string[];
  first_tier_variations: FirstTierVariation[];
  sorted_variation_image_index_list: number[];
  overlay: Overlay;
  makeup_preview: any;
  abnormal_status: string;
  promotion_images: any[];
  long_images: any;
  shopee_video_info_list: any[];
  shopee_video_rcmd_info: any;
  shopee_video_req_id: any;
  skincam: any;
  pdp_top_info_list: any;
  has_long_image: any;
  show_find_similar: boolean;
}

export interface FirstTierVariation {
  name: string;
  image: string;
  summed_stock: any;
  display_indicator: number;
  show_find_similar: boolean;
  name_tr: any;
}

export interface Overlay {
  type: number;
  image: string;
  preview_end_time: any;
  is_pre_order: any;
  description: string;
}

export interface ProductPrice2 {
  discount: number;
  installment_info: any;
  spl_installment_info: any;
  pack_size: string;
  hide_price: boolean;
  price: Price3;
  price_before_discount: PriceBeforeDiscount3;
  presale_price: any;
  lowest_past_price: any;
  labels: any;
  hide_discount: boolean;
  discount_text: any;
  show_final_price_indicator: boolean;
  final_price_vouchers: FinalPriceVoucher2[];
  has_final_price: boolean;
}

export interface Price3 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface PriceBeforeDiscount3 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface FinalPriceVoucher2 {
  promotion_id: number;
  voucher_code: string;
  is_auto_claimed_just_now: boolean;
  groups: any;
}

export interface ProductMeta {
  show_lowest_price_guarantee: any;
  show_original_guarantee: any;
  show_best_price_guarantee: boolean;
  show_official_shop_label_in_title: boolean;
  show_shopee_verified_label: boolean;
  show_lowest_installment_guarantee: any;
  hide_sharing_button: boolean;
  hide_sold_count: boolean;
}

export interface ProductReview {
  rating_star: number;
  rating_count: number[];
  total_rating_count: number;
  historical_sold: any;
  global_sold: any;
  liked: boolean;
  liked_count: number;
  cmt_count: number;
  should_move_ratings_above: any;
  review_rcmd_exp_group: any;
  display_global_sold: boolean;
  hide_rating: boolean;
  hide_buyer_gallery: boolean;
  hide_reviews: boolean;
  hide_other_product_reviews_in_shop: boolean;
  sold_count_disclosure: any;
}

export interface PromotionInfo2 {
  spl: any;
  spl_lite: any;
  installment: any;
  wholesale: any;
  insurance: any;
  item_installment_eligibility: ItemInstallmentEligibility;
}

export interface ItemInstallmentEligibility {
  is_cc_installment_payment_eligible: boolean;
  is_non_cc_installment_payment_eligible: boolean;
}

export interface AgeGate {
  kyc: any;
}

export interface ProductShipping {
  free_shipping: FreeShipping;
  shipping_fee_info: ShippingFeeInfo;
  show_shipping_to: boolean;
  ungrouped_channel_infos: UngroupedChannelInfo[];
  grouped_channel_infos_by_service_type: any[];
  also_available_channel_name: string;
  pre_selected_shipping_channel: PreSelectedShippingChannel;
  show_grouped_channel_first: boolean;
  is_item_with_price_range: boolean;
  also_available_channel_icon_type: any;
  pre_order_text: string;
  selected_late_delivery_compensation_for_drawer: any;
  shipping_info_text: ShippingInfoText;
  formatted_pre_order_text: any;
}

export interface FreeShipping {
  min_spend: MinSpend;
  has_fss: boolean;
}

export interface MinSpend {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface ShippingFeeInfo {
  ship_from_location: string;
  price: Price4;
  shipping_icon_type: number;
  warning: any;
}

export interface Price4 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface UngroupedChannelInfo {
  channel_id: number;
  name: string;
  price: Price5;
  price_before_discount?: PriceBeforeDiscount4;
  channel_delivery_info: ChannelDeliveryInfo;
  channel_promotion_infos: ChannelPromotionInfo[];
  warning: any;
  shipping_icon_type: any;
  lowest_bpsf_promotion_rule: any;
  service_type_info: string;
  is_integrated_channel: boolean;
  late_delivery_compensation?: LateDeliveryCompensation;
  is_sst_included: boolean;
  display_text: DisplayText;
  rule_type: number;
  is_xdd_channel: boolean;
  show_shopee_plus_icon: boolean;
  xdd_value: any;
}

export interface Price5 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface PriceBeforeDiscount4 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface ChannelDeliveryInfo {
  has_edt: boolean;
  display_mode: string;
  estimated_delivery_date_from: number;
  estimated_delivery_date_to: number;
  estimated_delivery_time_min: number;
  estimated_delivery_time_max: number;
  delay_message?: string;
  is_fastest_edt_channel: boolean;
  sla_message: string;
  show_edt: boolean;
  edt_text: string;
  formatted_edt_text: FormattedEdtText[];
  formatted_pre_order_text: any;
  formatted_fbs_description_text: any;
}

export interface FormattedEdtText {
  template: string;
  format: any;
  attributes: any;
  text_color: any;
  text_hex_color: any;
}

export interface ChannelPromotionInfo {
  rule_id: number;
  type: number;
  display_mode?: number;
  discount_off?: number;
  min_spend: MinSpend2;
  cap?: number;
}

export interface MinSpend2 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface LateDeliveryCompensation {
  type: number;
  amount: number;
  is_guaranteed_edt: boolean;
  compensation_amount: any;
  text: any;
}

export interface DisplayText {
  late_delivery_compensation?: LateDeliveryCompensation2;
  direct_delivery: any;
  fulfilled_by_shopee: any;
  spx_instant_delivery: any;
}

export interface LateDeliveryCompensation2 {
  text: string;
  gdt_max: any;
  compensation_amount: CompensationAmount;
}

export interface CompensationAmount {
  value: number;
}

export interface PreSelectedShippingChannel {
  channel_id: number;
  name: string;
  price: Price6;
  price_before_discount: PriceBeforeDiscount5;
  channel_delivery_info: ChannelDeliveryInfo2;
  channel_promotion_infos: any[];
  warning: Warning;
  shipping_icon_type: any;
  lowest_bpsf_promotion_rule: any;
  service_type_info: string;
  is_integrated_channel: boolean;
  late_delivery_compensation: any;
  is_sst_included: boolean;
  display_text: DisplayText2;
  rule_type: number;
  is_xdd_channel: boolean;
  show_shopee_plus_icon: boolean;
  xdd_value: number;
}

export interface Price6 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface PriceBeforeDiscount5 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface ChannelDeliveryInfo2 {
  has_edt: boolean;
  display_mode: string;
  estimated_delivery_date_from: number;
  estimated_delivery_date_to: number;
  estimated_delivery_time_min: number;
  estimated_delivery_time_max: number;
  delay_message: string;
  is_fastest_edt_channel: boolean;
  sla_message: string;
  show_edt: boolean;
  edt_text: string;
  formatted_edt_text: FormattedEdtText2[];
  formatted_pre_order_text: any;
  formatted_fbs_description_text: any;
}

export interface FormattedEdtText2 {
  template: string;
  format: any[];
  attributes: any;
  text_color: any;
  text_hex_color: any;
}

export interface Warning {
  type: string;
  warning_msg: string;
}

export interface DisplayText2 {
  late_delivery_compensation: any;
  direct_delivery: any;
  fulfilled_by_shopee: any;
  spx_instant_delivery: any;
}

export interface ShippingInfoText {
  text_template: any;
  shipping_fee: any;
  edt_from: any;
  edt_to: any;
  show_shipping_fee_suffix: boolean;
  formatted_text: FormattedText;
  highlight_free_shipping: boolean;
}

export interface FormattedText {
  edt: Edt;
  shipping_fee: any;
  late_delivery_compensation: any;
  fbs_description: any;
  display_edt_text_first_line: boolean;
}

export interface Edt {
  template: string;
  format: any;
  attributes: Attribute2[];
  text_color: any;
  text_hex_color: any;
}

export interface Attribute2 {
  type: number;
  key: string;
  value: Value;
  format: any;
  text_color: any;
  text_hex_color: any;
}

export interface Value {
  value_str: any;
  value_int: number;
}

export interface ShopVoucher2 {
  promotionid: number;
  voucher_code: string;
  signature: string;
  use_type: number;
  platform_type: any;
  voucher_market_type: number;
  min_spend: number;
  used_price: number;
  current_spend: any;
  product_limit: boolean;
  quota_type: number;
  percentage_claimed: number;
  percentage_used: number;
  start_time: number;
  end_time: number;
  collect_time: number;
  claim_start_time: number;
  valid_days: number;
  reward_type: number;
  reward_percentage: number;
  reward_value: number;
  reward_cap: number;
  coin_earned: any;
  title: any;
  use_link: any;
  icon_hash: string;
  icon_text: string;
  icon_url: any;
  customised_labels: any[];
  customised_product_scope_tags: any;
  shop_id: number;
  shop_name: string;
  is_shop_preferred: boolean;
  is_shop_official: boolean;
  shop_count: any;
  ui_display_type: any;
  customised_mall_name: any;
  small_icon_list: any;
  dp_category_name: any;
  invalid_message_code: any;
  invalid_message: any;
  display_labels: any;
  wallet_redeemable: boolean;
  customer_reference_id: string;
  fully_redeemed: any;
  has_expired: any;
  disabled: any;
  voucher_external_market_type: any;
  now_food_extra_info: any;
  airpay_opv_extra_info: any;
  partner_extra_info: any;
  discount_value: number;
  discount_percentage: number;
  discount_cap: number;
  coin_percentage: any;
  coin_cap: any;
  usage_limit: any;
  used_count: any;
  left_count: any;
  shopee_wallet_only: boolean;
  new_user_only: any;
  description: string;
  shop_logo: string;
  error_code: number;
  is_claimed_before: boolean;
  customised_product_scope_tag_image_hash: any;
  usage_limit_per_user: number;
  remaining_usage_limit: number;
  action: any;
  sub_icon_text: any;
  is_customised_icon: any;
  fixed_flag: any;
  customised_flag: any;
  fsv_voucher_card_ui_info: any;
}

export interface CoinInfo {
  spend_cash_unit: number;
  coin_earn_items: CoinEarnItem[];
  coin_earn_label: any;
}

export interface CoinEarnItem {
  coin_earn: number;
}

export interface ProductAttributes {
  attrs: Attr[];
  categories: Category2[];
  related_items: any[];
}

export interface Attr {
  name: string;
  value: string;
  id?: number;
  is_timestamp: any;
  brand_option: any;
  val_id: any;
  url?: string;
  brand_id?: number;
  full_url?: string;
  type: number;
}

export interface Category2 {
  catid: number;
  display_name: string;
  no_sub: boolean;
  is_default_subcat: boolean;
}

export interface ShopDetailed {
  shopid: number;
  userid: number;
  last_active_time: number;
  vacation: boolean;
  place: string;
  account: Account2;
  is_shopee_verified: boolean;
  is_preferred_plus_seller: boolean;
  is_official_shop: boolean;
  shop_location: string;
  item_count: number;
  rating_star: number;
  response_rate: number;
  session_info: any;
  name: string;
  ctime: number;
  response_time: number;
  follower_count: number;
  show_official_shop_label: boolean;
  rating_bad: number;
  rating_good: number;
  rating_normal: number;
  session_infos: any;
  status: number;
  is_individual_seller: any;
  is_mart: boolean;
  favorite_shop_info: any;
  is_3pf: boolean;
  sold_total: any;
  is_shopee_choice: boolean;
  is_high_end: boolean;
  banner: Banner;
  authorized_brand: any;
  is_scs: boolean;
  shop_location_tr: any;
}

export interface Account2 {
  portrait: string;
  username: string;
  status: number;
}

export interface Banner {
  shopee_choice: any;
}

export interface DisplaySections {
  add_on_deal: any;
  bundle_deal: any;
  exclusive_price_label: any;
  free_return: any;
  coin: any;
  wholesale: any;
}

export interface DesignControl {
  use_new_revamp_first_screen: any;
  display_on_time_delivery_guarantee: boolean;
  disable_price_with_variation: boolean;
  display_direct_delivery: boolean;
  use_new_featured_video_revamp: any;
  first_screen_revamp_abtest_group: any;
  display_choice_customised_section: boolean;
  is_support_fbs_enabled: boolean;
  top_section_featured_video_ab_test_group: any;
  enable_ksp_config: any;
  disable_main_page_select_variation: any;
  support_shop_review_preview: any;
  pdp_revamp_phase1_improvement_ui_review_down: any;
}

export interface ButtonGroup2 {
  buy_with_voucher: any;
}

export interface InstallmentDrawer {
  priority: number[];
  spl: any;
  bank: Bank;
  credit_card: any;
}

export interface Bank {
  channels: any;
}

export interface PriceBreakdown2 {
  price: Price7;
  price_before_discount: PriceBeforeDiscount6;
  discount_breakdown: DiscountBreakdown2[];
}

export interface Price7 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface PriceBeforeDiscount6 {
  single_value: number;
  range_min: number;
  range_max: number;
  price_mask: any;
}

export interface DiscountBreakdown2 {
  type: number;
  price_source: string;
  discount_amount: number;
  exclusive_price: any;
  shop_voucher?: ShopVoucher3;
  platform_voucher: any;
}

export interface ShopVoucher3 {
  min_spend: number;
  discount_type: number;
  discount_value: any;
  discount_percentage: string;
}

export interface ServiceEntrance {
  services: Service[];
}

export interface Service {
  text: string;
  type: number;
  id: number;
}

export interface ServiceDrawer {
  services: Service2[];
}

export interface Service2 {
  title: string;
  description: string;
  type: number;
  free_return: any;
  insurance: any;
  id: number;
  redirection_url: string;
  icon: string;
  insurance_drawer: any;
}

export interface ProductDescription {
  paragraph_list: ParagraphList2[];
}

export interface ParagraphList2 {
  type: number;
  text?: string;
  img_id?: string;
  ratio?: number;
  empty_paragraph_count?: number;
}
