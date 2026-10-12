import type { RoomType } from "../enums/room-type.enum";
import type { DesignStyle } from "../enums/design-style.enum";

export interface BlogPriceRow {
  item: string;
  budget: string;
  mid: string;
}

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogPostSummary {
  slug: string;
  title: string;
  dek: string;
  roomType: RoomType;
  style: DesignStyle;
  imageUrl: string;
  imageAlt: string;
  publishedAt: string;
}

export interface BlogPostDetail extends BlogPostSummary {
  problems: string[];
  palette: string;
  materials: string;
  lighting: string;
  priceTable: BlogPriceRow[];
  faq: BlogFaqItem[];
}

export interface CreateBlogPostRequest {
  slug: string;
  title: string;
  dek: string;
  roomType: RoomType;
  style: DesignStyle;
  imageUrl: string;
  imageAlt: string;
  problems: string[];
  palette: string;
  materials: string;
  lighting: string;
  priceTable: BlogPriceRow[];
  faq: BlogFaqItem[];
  sourceImageKey: string;
}
