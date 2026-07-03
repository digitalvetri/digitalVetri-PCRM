import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { SERVICE_PAGES, getServicePage } from "@/lib/marketing";
import { Button } from "@/components/ui/button";

export function generateStaticParams() {
  return SERVICE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) return {};
  return {
    title: `${page.seoTitle} | DigitalVetri`,
    description: page.seoDescription,
    robots: { index: true, follow: true },
    alternates: { canonical: `/services/${page.slug}` },
    openGraph: { title: page.seoTitle, description: page.seoDescription, type: "website" },
  };
}

export default async function ServicePageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getServicePage(slug);
  if (!page) notFound();

  const enquiryHref = `/enquiry?service=${encodeURIComponent(page.service)}`;

  // FAQ rich-result schema for Google.
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Hero */}
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-primary">{page.service}</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {page.headline}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{page.sub}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={enquiryHref}>Get a free consultation</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/services">All services</Link>
          </Button>
        </div>
      </div>

      {/* Benefits */}
      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        {page.benefits.map((b) => (
          <div key={b.title} className="flex items-start gap-3 rounded-2xl border bg-card p-5 shadow-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">{b.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FAQs */}
      <div className="mt-14 max-w-3xl">
        <h2 className="text-xl font-semibold">Common questions</h2>
        <dl className="mt-5 space-y-5">
          {page.faqs.map((f) => (
            <div key={f.q} className="rounded-2xl border bg-card p-5">
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Bottom CTA */}
      <div className="mt-14 rounded-2xl bg-primary p-8 text-center text-primary-foreground sm:p-10">
        <h2 className="text-2xl font-bold">Ready to get started?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm opacity-90">
          Tell us what you need — we&apos;ll call you back with a free, no-obligation consultation,
          usually the same day.
        </p>
        <Button asChild size="lg" variant="secondary" className="mt-6">
          <Link href={enquiryHref}>Request a callback</Link>
        </Button>
      </div>
    </main>
  );
}
