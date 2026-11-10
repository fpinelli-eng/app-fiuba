import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/site";

// Search engines see only the public pages (presentation and privacy); everything else needs a session.
// Preview deployments are not indexed at all.
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/auth", "/carrera"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
