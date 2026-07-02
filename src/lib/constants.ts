// Central catalogue of business constants used across the platform.

export const CRM_MODULES = [
  "Sales CRM",
  "Quotation",
  "Purchase",
  "Inventory",
  "Production",
  "Quality",
  "HR",
  "Attendance",
  "Payroll",
  "Dispatch",
  "Warehouse",
  "Accounts Integration",
  "Service Management",
  "AMC",
  "Complaint Management",
  "Asset Management",
  "Visitor Management",
  "Document Management",
  "Reports",
  "Analytics",
  "Management Dashboard",
  "AI Chatbot",
  "WhatsApp Automation",
  "Email Automation",
  "Lead Automation",
  "Task Automation",
  "Approval Workflow",
  "Role Management",
] as const;

export type CrmModule = (typeof CRM_MODULES)[number];

/**
 * DigitalVetri's full service portfolio — used across analysis, recommendations
 * and content so the AI positions the right offering (not just CRM). CRM_MODULES
 * above are the granular modules within custom CRM/ERP builds.
 */
export const SERVICES = [
  "Custom CRM Development",
  "ERP Development",
  "Website Development",
  "SaaS / Web App Development",
  "Mobile App Development",
  "Digital Marketing (SEO, Social Media, Paid Ads)",
  "AI Automation & Chatbots",
  "WhatsApp Business Automation",
  "Business Software & Dashboards",
] as const;

export type Service = (typeof SERVICES)[number];

export const INDUSTRIES = [
  "Manufacturing",
  "Construction",
  "Healthcare",
  "Education",
  "Logistics",
  "Retail & E-commerce",
  "IT & Software",
  "Automotive",
  "Textiles & Apparel",
  "Food & Beverage",
  "Pharmaceuticals",
  "Chemicals",
  "Engineering Services",
  "Real Estate",
  "Financial Services",
  "Hospitality",
  "Agriculture",
  "Energy & Utilities",
  "Trading & Distribution",
  "Other",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const LEAD_GRADES = ["A_PLUS", "A", "B", "C"] as const;

export const LEAD_GRADE_LABELS: Record<string, string> = {
  A_PLUS: "A+",
  A: "A",
  B: "B",
  C: "C",
};

export const LEAD_GRADE_COLORS: Record<string, string> = {
  A_PLUS: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  A: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  B: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  C: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
};

export const PROSPECT_STATUSES = [
  "NEW",
  "RESEARCHING",
  "QUALIFIED",
  "CONTACTED",
  "MEETING_SCHEDULED",
  "MEETING_DONE",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
  "ON_HOLD",
  "DISQUALIFIED",
] as const;

export const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  RESEARCHING: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  QUALIFIED: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  CONTACTED: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  MEETING_SCHEDULED: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  MEETING_DONE: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  PROPOSAL_SENT: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  NEGOTIATION: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  WON: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  LOST: "bg-red-500/15 text-red-600 dark:text-red-400",
  ON_HOLD: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  DISQUALIFIED: "bg-slate-500/15 text-slate-500",
};

// Ordered funnel stages for the sales-funnel chart
export const FUNNEL_STAGES = [
  { key: "TOTAL", label: "Total Companies" },
  { key: "QUALIFIED", label: "Qualified" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "MEETING", label: "Meeting" },
  { key: "PROPOSAL", label: "Proposal" },
  { key: "NEGOTIATION", label: "Negotiation" },
  { key: "WON", label: "Won" },
] as const;

export const EMPLOYEE_RANGES = [
  { label: "1-10", min: 1, max: 10 },
  { label: "11-25", min: 11, max: 25 },
  { label: "26-50", min: 26, max: 50 },
  { label: "51-100", min: 51, max: 100 },
  { label: "101-250", min: 101, max: 250 },
  { label: "251-500", min: 251, max: 500 },
  { label: "500+", min: 501, max: 1_000_000 },
] as const;

export const REVENUE_RANGES = [
  "Under ₹1 Cr",
  "₹1-5 Cr",
  "₹5-10 Cr",
  "₹10-25 Cr",
  "₹25-50 Cr",
  "₹50-100 Cr",
  "₹100+ Cr",
] as const;

export const BRAND = {
  name: "DigitalVetri",
  productName: "AI Sales Intelligence",
  primaryColor: "#3047CA",
  website: "https://digitalvetri.com",
  email: "info@digitalvetri.com",
} as const;
