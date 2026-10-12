import type { MetadataRoute } from "next";
import { publicQualifications, qualificationHref } from "@/lib/cbt-home-catalog";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/cbt/` },
    { url: `${SITE_URL}/terms/` },
    ...publicQualifications.map(item => ({ url: `${SITE_URL}${qualificationHref(item.slug)}` })),
  ];
}
