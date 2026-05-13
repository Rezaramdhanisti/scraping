
export interface ShopeeSpResponse {
  error: number
  error_msg: string
  data: Data
}

export interface Data {
  key: string
  total: number
  no_more: boolean
  user_behaviour_config: UserBehaviourConfig
  centralize_item_card: CentralizeItemCard
  item_card_abt_data: ItemCardAbtData
  item_version: number
  dynamic_translation_status: number
}

export interface UserBehaviourConfig {
  user_behaviour_config_list: UserBehaviourConfigList[]
}

export interface UserBehaviourConfigList {
  behaviour_type: string
  count: number
  duration_second: number
  page_infos: string[]
}

export interface CentralizeItemCard {
  item_cards: ItemCard[]
  card_set: CardSet
  card_version: string
}

export interface ItemCard {
  itemid: number
  shopid: number
  is_adult: boolean
  need_kyc: boolean
  item_card_display_price: ItemCardDisplayPrice
  item_card_display_sold_count: ItemCardDisplaySoldCount
  is_sold_out: boolean
  is_preview: boolean
  label_ids: number[]
  catid: number
  shopee_verified: boolean
  liked_count: number
  item_type: number
  reference_item_id: string
  shop_data: ShopData
  status: number
  ctime: number
  flag: number
  item_status: string
  global_cat: GlobalCat
  item_rating: ItemRating
  global_brand: GlobalBrand
  video_info_list?: VideoInfoList[]
  tier_variations: TierVariation[]
  item_card_displayed_asset: ItemCardDisplayedAsset
  info: string
  data_type: string
  deduction_info: string
  display_ad_tag: number
  traffic_source: number
  adsid: number
  campaign_id: number
  ctx_item_type: number
}

export interface ItemCardDisplayPrice {
  item_id: number
  model_id: number
  promotion_type: number
  promotion_id: number
  price: number
  strikethrough_price?: number
  discount: number
}

export interface ItemCardDisplaySoldCount {
  historical_sold_count: number
  monthly_sold_count: number
  historical_sold_count_text?: string
  monthly_sold_count_text?: string
}

export interface ShopData {
  shop_name: string
  shop_location: string
}

export interface GlobalCat {
  catid: number[]
}

export interface ItemRating {
  rating_star: number
  rating_count: number[]
}

export interface GlobalBrand {
  brand_id: number
}

export interface VideoInfoList {
  video_id: string
  thumb_url: string
  duration: number
  version: number
  vid: string
  formats: Format[]
  default_format: DefaultFormat
  mms_data: string
}

export interface Format {
  format: number
  defn: string
  profile: string
  path: string
  url: string
  width: number
  height: number
}

export interface DefaultFormat {
  format: number
  defn: string
  profile: string
  path: string
  url: string
  width: number
  height: number
}

export interface TierVariation {
  name: string
  options: string[]
  images?: string[]
  type: number
}

export interface ItemCardDisplayedAsset {
  name: string
  image: string
  images: string[]
  icon_in_image: IconInImage
  seller_flag: SellerFlag
  discount_tag?: DiscountTag
  rating: Rating
  sold_count?: SoldCount
  promotion_label_list?: PromotionLabelList[]
}

export interface IconInImage {
  icon_type?: number
  ads_text: string
}

export interface SellerFlag {
  name: string
  image_flag: ImageFlag
}

export interface ImageFlag {
  hash: string
  width: number
  height: number
}

export interface DiscountTag {
  discount_text: string
}

export interface Rating {
  rating_text: string
  icon: Icon
  rating_type: number
}

export interface Icon {
  hash: string
  width: number
  height: number
}

export interface SoldCount {
  text: string
}

export interface PromotionLabelList {
  type: string
  style: string
  specs: Specs
  data: Data2
}

export interface Specs {
  text_color: string
  border_color: string
}

export interface Data2 {
  text: string
}

export interface CardSet {
  layout_id: number
  element_toggle: ElementToggle
  card_set_name: string
}

export interface ElementToggle {
  atc_button: boolean
  feedback_button: boolean
}

export interface ItemCardAbtData {
  hit_exp_group: string
}
