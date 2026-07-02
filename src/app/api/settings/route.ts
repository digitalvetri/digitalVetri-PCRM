import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, getCurrentUser, roleCan, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/settings";

/** GET /api/settings — current settings + current user. */
export async function GET() {
  return withApi(async () => {
    const user = await getCurrentUser();
    if (!user || !user.isActive) throw new ApiError(401, "Not authenticated");

    const settings = await loadSettings();
    return {
      settings,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      canManage: roleCan(user.role, "settings.manage"),
    };
  });
}

const companyProfileSchema = z.object({
  name: z.string().max(200),
  // Validate format when provided, but allow an empty string (optional field).
  email: z.string().email().or(z.literal("")),
  phone: z.string().max(40),
  website: z.string().url().or(z.literal("")),
  address: z.string().max(500),
});

const patchSchema = z.object({
  aiProvider: z.enum(["openai", "claude", "gemini"]).optional(),
  defaultCurrency: z.string().optional(),
  companyProfile: companyProfileSchema.optional(),
  monthlyRevenueTarget: z.number().nonnegative().nullable().optional(),
});

/** PATCH /api/settings — upsert provided setting keys. */
export async function PATCH(req: Request) {
  return withApi(async () => {
    await requireUser("settings.manage");
    const body = patchSchema.parse(await req.json());

    const entries: [string, unknown][] = Object.entries(body).filter(
      ([, v]) => v !== undefined
    );

    await Promise.all(
      entries.map(([key, value]) =>
        prisma.appSetting.upsert({
          where: { key },
          create: { key, value: value as never },
          update: { value: value as never },
        })
      )
    );

    const settings = await loadSettings();
    return { settings };
  });
}
