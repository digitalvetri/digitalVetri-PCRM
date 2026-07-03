import type { MetadataRoute } from "next";
import { SERVICE_PAGES } from "@/lib/marketing";

/** Sitemap of the PUBLIC marketing surface only (the CRM itself is noindex). */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://dv-crm.online";
  return [
    { url: `${base}/services`, changeFrequency: "weekly", priority: 1 },
    ...SERVICE_PAGES.map((p) => ({
      url: `${base}/services/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    { url: `${base}/enquiry`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
