import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { MetaPixel } from "@/components/marketing/meta-pixel";

/** Public marketing chrome — light header + footer around the service pages. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <MetaPixel />
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/services" aria-label="DigitalVetri services">
            <Logo tileSize={36} subtitle="Technology Services" />
          </Link>
          <Button asChild size="sm">
            <Link href="/enquiry">Get a free consultation</Link>
          </Button>
        </div>
      </header>
      {children}
      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 text-center text-sm text-muted-foreground">
          <Logo tileSize={30} subtitle="Technology Services" />
          <p>DigitalVetri — websites, marketing, AI automation and custom software for growing businesses.</p>
          <p>
            Coimbatore, Tamil Nadu ·{" "}
            <a href="mailto:info@digitalvetri.com" className="text-primary hover:underline">
              info@digitalvetri.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
