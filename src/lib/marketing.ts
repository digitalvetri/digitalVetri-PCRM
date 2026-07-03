import type { Service } from "@/lib/constants";

/**
 * Content for the public SEO landing pages (/services/[slug]) — the inbound
 * engine. Each page targets what a Coimbatore/Tamil Nadu buyer actually types
 * into Google and funnels to /enquiry with the service pre-selected.
 */
export interface ServicePage {
  slug: string;
  service: Service; // exact SERVICES value → pre-selects the enquiry form
  seoTitle: string;
  seoDescription: string;
  headline: string;
  sub: string;
  benefits: { title: string; desc: string }[];
  faqs: { q: string; a: string }[];
}

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: "website-development-coimbatore",
    service: "Website Development",
    seoTitle: "Website Development Company in Coimbatore",
    seoDescription:
      "Professional, mobile-first business websites for Coimbatore & Tamil Nadu businesses. Fast delivery, SEO-ready, WhatsApp-integrated. Free consultation.",
    headline: "Websites that win customers — built in Coimbatore",
    sub: "Your customers search online before they call. We build fast, mobile-first websites that make your business the obvious choice — with enquiry forms and WhatsApp chat wired in from day one.",
    benefits: [
      { title: "Mobile-first design", desc: "Most Indian buyers browse on their phone — your site will look sharp and load fast on every device." },
      { title: "Built to rank on Google", desc: "Clean SEO structure so people searching for your services in your city actually find you." },
      { title: "WhatsApp & enquiry ready", desc: "Every page nudges visitors to message you on WhatsApp or leave their number." },
      { title: "You own everything", desc: "Your domain, your content, your code — no lock-in, no monthly ransom." },
    ],
    faqs: [
      { q: "How long does a business website take?", a: "A standard business website goes live in 1–2 weeks. E-commerce or custom features take longer — we give you an exact timeline after a free consultation." },
      { q: "What does a website cost?", a: "It depends on pages and features. Tell us what you need and we'll quote a fixed price up front — no surprises." },
      { q: "Do you handle domain, hosting and maintenance?", a: "Yes — we can manage domain, hosting, SSL and updates end-to-end, or hand everything over to your team." },
    ],
  },
  {
    slug: "digital-marketing-coimbatore",
    service: "Digital Marketing (SEO, Social Media, Paid Ads)",
    seoTitle: "Digital Marketing Agency in Coimbatore — SEO, Social & Ads",
    seoDescription:
      "SEO, Google & Meta ads, and social media that bring real enquiries — not vanity metrics. Digital marketing for Coimbatore businesses. Free audit.",
    headline: "Marketing that brings enquiries, not just likes",
    sub: "We run SEO, Google Ads and Meta ads focused on one number: qualified enquiries reaching your phone. Every campaign is tracked to actual leads, not impressions.",
    benefits: [
      { title: "Local SEO that works", desc: "Rank for the searches your buyers make — “near me”, your city, your service." },
      { title: "Ads with lead tracking", desc: "Google & Meta campaigns wired to enquiry forms and WhatsApp, so you see exactly what each lead costs." },
      { title: "Content that builds trust", desc: "Social presence and content that makes your business look as good online as it is offline." },
      { title: "Monthly clarity", desc: "A simple report: what we spent, what leads came in, what to do next month." },
    ],
    faqs: [
      { q: "How soon will I see leads?", a: "Paid ads can bring enquiries within days. SEO compounds over 2–4 months. We usually run both: ads for now, SEO for forever." },
      { q: "What budget do I need?", a: "Meaningful local campaigns start around ₹10–15k/month in ad spend. We'll recommend a budget based on your goals — and never spend more than agreed." },
      { q: "Do you work with my existing website?", a: "Yes. We audit it first — sometimes small fixes double conversion before a single rupee goes to ads." },
    ],
  },
  {
    slug: "ai-automation-chatbots",
    service: "AI Automation & Chatbots",
    seoTitle: "AI Automation & Chatbot Development for Business",
    seoDescription:
      "Automate enquiries, follow-ups and repetitive work with AI chatbots and workflow automation. Built for Indian SMEs. Free consultation in Coimbatore.",
    headline: "Put AI to work in your business — practically",
    sub: "Answer customer questions 24/7, qualify enquiries automatically, and remove hours of repetitive work — with AI automation built around how your business actually runs.",
    benefits: [
      { title: "24/7 instant replies", desc: "An AI assistant on your website and WhatsApp that answers, qualifies and books — even at midnight." },
      { title: "Workflow automation", desc: "Quotes, reminders, reports and data entry that happen automatically instead of eating your team's day." },
      { title: "Works with your tools", desc: "We connect AI to the software you already use — spreadsheets, CRM, Tally, WhatsApp." },
      { title: "Practical, not hype", desc: "We start with one high-value workflow, prove the saving, then expand." },
    ],
    faqs: [
      { q: "Is AI automation only for big companies?", a: "No — SMEs often gain the most, because one automation can free a whole person's worth of hours. We scope to your size and budget." },
      { q: "Will the chatbot sound robotic?", a: "It's trained on your services, prices and tone, and hands over to a human the moment a conversation needs one." },
      { q: "What does it cost to start?", a: "A focused first automation or chatbot is a small fixed project. We'll quote after understanding the workflow you want to automate." },
    ],
  },
  {
    slug: "custom-crm-development",
    service: "Custom CRM Development",
    seoTitle: "Custom CRM Development for Growing Businesses",
    seoDescription:
      "A CRM built around your sales process — leads, follow-ups, quotes and WhatsApp in one place. Custom CRM development from Coimbatore.",
    headline: "A CRM that fits your business — not the other way around",
    sub: "Off-the-shelf CRMs force your team into someone else's process. We build CRMs around how you actually sell — so your team uses it, and no lead falls through the cracks.",
    benefits: [
      { title: "Your exact sales flow", desc: "Stages, fields and reports that mirror how your business really works." },
      { title: "WhatsApp & call friendly", desc: "Built for how Indian sales actually happen — follow-ups, reminders and WhatsApp in one screen." },
      { title: "No per-user rent", desc: "Own the system. Add unlimited team members without a monthly per-seat bill." },
      { title: "Grows with you", desc: "Start with lead tracking; add quotes, invoicing and analytics when you're ready." },
    ],
    faqs: [
      { q: "Why custom instead of Zoho/Salesforce?", a: "If a ready-made CRM fits you, use it. Custom wins when your process is unique, per-user pricing hurts, or adoption keeps failing — we'll tell you honestly which is your case." },
      { q: "How long does a CRM take to build?", a: "A focused first version is typically 3–6 weeks. You start using it early and we refine with your team's feedback." },
      { q: "Can you migrate our existing data?", a: "Yes — Excel sheets, old CRMs, wherever your leads live today, we bring them across cleanly." },
    ],
  },
  {
    slug: "whatsapp-business-automation",
    service: "WhatsApp Business Automation",
    seoTitle: "WhatsApp Business API & Automation for Indian Businesses",
    seoDescription:
      "Automated WhatsApp for orders, enquiries, reminders and campaigns using the official Business API. WhatsApp automation from Coimbatore.",
    headline: "Your business runs on WhatsApp. Automate it.",
    sub: "Auto-reply to enquiries, send order updates and reminders, run broadcast campaigns — on the official WhatsApp Business API, without your team typing every message.",
    benefits: [
      { title: "Official API, no bans", desc: "Green-tick verified, compliant automation — not risky unofficial tools." },
      { title: "Instant enquiry handling", desc: "Every WhatsApp enquiry gets an immediate, useful reply and lands in your lead list." },
      { title: "Broadcasts that convert", desc: "Offers and updates to opted-in customers, with delivery and reply tracking." },
      { title: "Connects to your systems", desc: "Orders, bookings and payments flow between WhatsApp and your software automatically." },
    ],
    faqs: [
      { q: "Is this the official WhatsApp API?", a: "Yes — we set you up on Meta's official WhatsApp Business Platform, including verification and templates." },
      { q: "Can customers still reach a human?", a: "Always. Automation handles the routine; your team steps into any chat at any time." },
      { q: "What does WhatsApp automation cost?", a: "Setup is a fixed project; Meta charges small per-conversation fees. We'll estimate both for your volume before you commit." },
    ],
  },
  {
    slug: "erp-development",
    service: "ERP Development",
    seoTitle: "Custom ERP Development for SMEs & Manufacturers",
    seoDescription:
      "Custom ERP for manufacturers and trading businesses — production, inventory, billing and reports in one system. ERP development from Coimbatore.",
    headline: "One system for your whole operation",
    sub: "Stop running your business across Tally, Excel and memory. We build ERPs for manufacturers and traders that connect production, inventory, billing and reporting — sized for SMEs, not enterprises.",
    benefits: [
      { title: "Made for your industry", desc: "Textiles, engineering, trading, services — modelled on your real workflow, not a generic template." },
      { title: "Live stock & production", desc: "Know your inventory, WIP and orders in real time instead of end-of-month surprises." },
      { title: "GST-ready billing & reports", desc: "Invoices, e-way bills and the reports your CA actually asks for." },
      { title: "Phased rollout", desc: "Go module by module so your team adopts smoothly — no big-bang risk." },
    ],
    faqs: [
      { q: "We already use Tally — do we need this?", a: "Tally is great for accounts. An ERP covers what Tally doesn't: production, inventory movements, orders and team workflows — and can sync with Tally." },
      { q: "How disruptive is implementation?", a: "We roll out in phases alongside your current process, migrate your data, and train your team — you're never left without a working system." },
      { q: "What does an SME ERP cost?", a: "A fraction of big-brand ERPs. Fixed module-wise pricing after a free process study." },
    ],
  },
  {
    slug: "mobile-app-development",
    service: "Mobile App Development",
    seoTitle: "Mobile App Development — Android & iOS",
    seoDescription:
      "Android & iOS apps for businesses — customer apps, delivery apps, internal tools. Mobile app development from Coimbatore at SME-friendly pricing.",
    headline: "Your business, in your customers' pocket",
    sub: "Customer ordering apps, delivery tracking, field-team tools — we build Android and iOS apps that are fast, simple and actually used.",
    benefits: [
      { title: "One codebase, both stores", desc: "Modern cross-platform builds mean Android + iOS without double the cost." },
      { title: "Designed for daily use", desc: "Simple flows your customers and staff understand without training." },
      { title: "Connected to your backend", desc: "Orders, payments and notifications synced with your website and systems." },
      { title: "Store launch handled", desc: "Play Store and App Store publishing, updates and crash monitoring included." },
    ],
    faqs: [
      { q: "App or website — which do I need?", a: "If customers use you occasionally, a great mobile website is enough. Apps win for repeat use — orders, bookings, loyalty. We'll advise honestly." },
      { q: "How long does an app take?", a: "A focused v1 typically ships in 4–8 weeks depending on features." },
      { q: "What about maintenance?", a: "We offer simple monthly care plans covering updates, OS changes and small improvements." },
    ],
  },
  {
    slug: "saas-web-app-development",
    service: "SaaS / Web App Development",
    seoTitle: "SaaS & Web Application Development",
    seoDescription:
      "Custom web applications and SaaS products — from idea to launch. Portals, marketplaces, booking systems. Web app development from Coimbatore.",
    headline: "From idea to working product",
    sub: "Customer portals, booking systems, marketplaces, or the SaaS idea you've been sitting on — we design, build and launch web applications that are secure, fast and ready to grow.",
    benefits: [
      { title: "Launch-focused scope", desc: "We cut to the smallest version that delivers value, so you launch in weeks, not years." },
      { title: "Modern, proven stack", desc: "The same technology stack powering world-class products — fast, secure, maintainable." },
      { title: "Built to scale", desc: "Architecture that handles growth from your first 10 users to your first 10,000." },
      { title: "You own the product", desc: "Full source code, documentation and handover — your product, your asset." },
    ],
    faqs: [
      { q: "I have an idea but no tech knowledge — can you help?", a: "That's most of our clients. We turn the idea into a scoped plan with fixed pricing before any build starts." },
      { q: "How much does a web app cost?", a: "A focused first version typically starts where a good website ends — the scope call is free and you'll get a fixed quote." },
      { q: "Will you maintain it after launch?", a: "Yes — hosting, monitoring, fixes and a roadmap for new features, or a clean handover to your own team." },
    ],
  },
  {
    slug: "business-software-dashboards",
    service: "Business Software & Dashboards",
    seoTitle: "Business Software & MIS Dashboards",
    seoDescription:
      "Custom business software and live MIS dashboards — sales, production, finance in one view. Built for Indian SMEs from Coimbatore.",
    headline: "See your whole business on one screen",
    sub: "Live dashboards and small custom tools that replace Excel chaos — sales, collections, production and stock in one view, updated automatically.",
    benefits: [
      { title: "Live MIS, zero effort", desc: "Numbers pulled automatically from your systems — no more “send me the Excel” every Monday." },
      { title: "Owner's view on mobile", desc: "Check sales, outstanding and stock from your phone, anywhere." },
      { title: "Replace fragile Excel", desc: "Multi-user tools with permissions and history, instead of one corrupted master sheet." },
      { title: "Small tools, big relief", desc: "Quotation makers, registers, approval flows — the unglamorous software that saves hours daily." },
    ],
    faqs: [
      { q: "Our data lives in Excel/Tally — can you use it?", a: "Yes. We connect to or import from Excel, Tally and most software, then keep the dashboard synced automatically." },
      { q: "How fast can a dashboard go live?", a: "A first working dashboard usually ships within 2–3 weeks of getting access to your data." },
      { q: "Is our business data safe?", a: "Your data stays in your own system with role-based access, backups and full audit history." },
    ],
  },
];

export function getServicePage(slug: string): ServicePage | undefined {
  return SERVICE_PAGES.find((p) => p.slug === slug);
}
