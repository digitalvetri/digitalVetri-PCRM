import type { Metadata } from "next";
import { Sparkles, Globe, Bot, TrendingUp } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { EnquiryForm } from "@/components/enquiry/enquiry-form";

export const metadata: Metadata = {
  title: "Get a free consultation",
  description:
    "Tell DigitalVetri what you need — websites, digital marketing, AI automation, custom software — and we'll call you back.",
  // This one IS a public marketing page, so let search engines find it.
  robots: { index: true, follow: true },
};

const HIGHLIGHTS = [
  { icon: Globe, text: "Websites & web apps that win customers" },
  { icon: TrendingUp, text: "Digital marketing that drives real leads" },
  { icon: Bot, text: "AI automation & chatbots that save hours" },
  { icon: Sparkles, text: "Custom CRM, ERP & business software" },
];

export default function EnquiryPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-2 lg:gap-16 lg:py-20">
        {/* Left — pitch */}
        <div className="flex flex-col justify-center">
          <Logo tileSize={44} subtitle="Sales Intelligence" />
          <h1 className="mt-8 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Grow your business with the right technology.
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            Tell us what you&apos;re looking for and our team will call you back with a free,
            no-obligation consultation — usually the same day.
          </p>
          <ul className="mt-8 space-y-3">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <h.icon className="h-4 w-4" />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Right — form */}
        <div className="flex flex-col justify-center">
          <EnquiryForm />
        </div>
      </div>
    </div>
  );
}
