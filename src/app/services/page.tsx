import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SERVICE_PAGES } from "@/lib/marketing";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Technology Services for Growing Businesses | DigitalVetri",
  description:
    "Websites, digital marketing, AI automation, WhatsApp automation, CRM/ERP and custom software — built in Coimbatore for Indian businesses. Free consultation.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/services" },
};

export default function ServicesIndexPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Technology that grows your business
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          From your first website to full AI automation — we build the digital side of your
          business, from Coimbatore, at prices that make sense for Indian SMEs.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/enquiry">Get a free consultation</Link>
        </Button>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICE_PAGES.map((p) => (
          <Link
            key={p.slug}
            href={`/services/${p.slug}`}
            className="group rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <h2 className="font-semibold leading-snug">{p.service}</h2>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{p.sub}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Learn more <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
