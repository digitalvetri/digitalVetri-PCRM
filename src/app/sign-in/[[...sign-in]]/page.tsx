import { SignIn } from "@clerk/nextjs";
import { Brain, Target, FileText, Sparkles } from "lucide-react";
import { Logo } from "@/components/shared/logo";

const FEATURES = [
  { icon: Brain, title: "AI prospect research", desc: "Enrich and qualify companies automatically." },
  { icon: Target, title: "Smart lead scoring", desc: "Rank every account by real buying potential." },
  { icon: FileText, title: "Proposals in seconds", desc: "Generate tailored proposals, emails and decks." },
  { icon: Sparkles, title: "CEO command center", desc: "Plan the day, coach the pitch, close faster." },
];

export default function SignInPage() {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-brand-mesh p-12 text-white lg:flex xl:w-[55%]">
        {/* decorative glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-red/20 blur-3xl" />

        <div className="relative z-10">
          <Logo tileSize={42} wordmarkClassName="text-lg text-white" subtitle="Sales Intelligence" />
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-balance xl:text-5xl">
            Turn prospects into pipeline — with AI.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-blue-100">
            Identify, research, qualify and manage high-value B2B prospects for custom CRM,
            AI automation and ERP development.
          </p>
          <ul className="mt-9 grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <f.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="block text-xs leading-relaxed text-blue-100/80">{f.desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-sm text-blue-200/80">
          © {new Date().getFullYear()} DigitalVetri. Internal use only.
        </p>
      </div>

      {/* Auth panel */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background p-6">
        <div className="lg:hidden">
          <Logo tileSize={40} subtitle="Sales Intelligence" />
        </div>
        <SignIn
          appearance={{
            variables: { colorPrimary: "#3047CA", borderRadius: "0.6rem" },
            elements: { cardBox: "shadow-none", card: "shadow-none" },
          }}
        />
      </div>
    </div>
  );
}
