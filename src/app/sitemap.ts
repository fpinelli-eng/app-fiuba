import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// The public pages: the presentation (shown at the root to anyone without a session) and the privacy policy.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/privacidad`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
