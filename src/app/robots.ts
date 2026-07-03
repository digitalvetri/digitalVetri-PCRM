import type { MetadataRoute } from "next";

/** Crawl only the public marketing surface; the CRM app and APIs stay private. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://dv-crm.online";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/services", "/enquiry"],
        disallow: ["/api/", "/sign-in", "/sign-up", "/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
