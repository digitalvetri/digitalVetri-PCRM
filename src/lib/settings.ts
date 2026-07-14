import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/constants";

export interface CompanyProfile {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
}

export interface AppSettings {
  aiProvider: "openai" | "claude" | "gemini" | "groq";
  defaultCurrency: string;
  companyProfile: CompanyProfile;
  /** CEO OS monthly revenue goal in INR (null = not set). */
  monthlyRevenueTarget: number | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: "openai",
  defaultCurrency: "INR",
  companyProfile: {
    name: BRAND.name,
    email: BRAND.email,
    phone: "",
    website: BRAND.website,
    address: "",
  },
  monthlyRevenueTarget: null,
};

/** Merge stored AppSetting rows onto sane defaults. */
export async function loadSettings(): Promise<AppSettings> {
  const rows = await prisma.appSetting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    aiProvider: (stored.aiProvider as AppSettings["aiProvider"]) ?? DEFAULT_SETTINGS.aiProvider,
    defaultCurrency: (stored.defaultCurrency as string) ?? DEFAULT_SETTINGS.defaultCurrency,
    companyProfile: {
      ...DEFAULT_SETTINGS.companyProfile,
      ...((stored.companyProfile as Partial<CompanyProfile>) ?? {}),
    },
    monthlyRevenueTarget:
      typeof stored.monthlyRevenueTarget === "number" ? stored.monthlyRevenueTarget : null,
  };
}
