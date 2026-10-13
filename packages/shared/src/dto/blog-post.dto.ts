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

// blog-admin (apps/web) queue list + edit view — covers SCHEDULED posts, which
// BlogPostSummary/Detail deliberately exclude (those are PUBLISHED-only, see
// BlogPostsService.findPublished/findBySlug). Not based on BlogPostDetail:
// that type's publishedAt is always a string (it falls back to createdAt for
// display on the public site), which would misrepresent a SCHEDULED post as
// already published.
export interface BlogPostAdminDetail {
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
  status: "SCHEDULED" | "PUBLISHED";
  scheduledFor: string;
  publishedAt: string | null;
}

export interface BlogPostQueueItem {
  slug: string;
  title: string;
  dek: string;
  roomType: RoomType;
  style: DesignStyle;
  imageUrl: string;
  imageAlt: string;
  scheduledFor: string;
}

export interface UpdateBlogPostRequest {
  title?: string;
  dek?: string;
  imageAlt?: string;
  problems?: string[];
  palette?: string;
  materials?: string;
  lighting?: string;
  priceTable?: BlogPriceRow[];
  faq?: BlogFaqItem[];
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
