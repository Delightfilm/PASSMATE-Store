import type { MetadataRoute } from "next";
import { publicQualifications, qualificationHref } from "@/lib/cbt-home-catalog";
import { SITE_URL } from "@/lib/seo";
import { learningGuides, learningGuideHref, learningGuideCheckedAt } from "@/lib/public-learning-guides";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/` },
    { url: `${SITE_URL}/cbt/` },
    { url: `${SITE_URL}/terms/` },
    { url: `${SITE_URL}/privacy/` },
    ...publicQualifications.map(item => ({ url: `${SITE_URL}${qualificationHref(item.slug)}` })),
    ...learningGuides.map(item => ({ url: `${SITE_URL}${learningGuideHref(item.slug)}`, lastModified: learningGuideCheckedAt })),
  ];
}
