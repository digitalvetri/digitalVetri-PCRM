import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { normalizeAdAccountId, validateAdAccount } from "@/lib/meta-ads";

/** Strip the secret before anything leaves the server. */
const masked = (c: { id: string; name: string; adAccountId: string; currency: string | null; accessToken: string; createdAt: Date }) => ({
  id: c.id,
  name: c.name,
  adAccountId: c.adAccountId,
  currency: c.currency,
  tokenHint: `•••${c.accessToken.slice(-4)}`,
  createdAt: c.createdAt,
});

/** GET /api/ads/accounts — list connected ad accounts (tokens masked). */
export async function GET() {
  return withApi(async () => {
    await requireUser("commandCenter.manage");
    const accounts = await prisma.adConnection.findMany({ orderBy: { createdAt: "asc" } });
    return { accounts: accounts.map(masked) };
  });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  adAccountId: z.string().trim().min(3).max(40),
  accessToken: z.string().trim().min(20).max(600),
});

/** POST /api/ads/accounts — connect an ad account (ADMIN; token validated live). */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("settings.manage");
    enforceRateLimit(`ads:connect:${user.id}`, 5, 60_000);
    const body = createSchema.parse(await req.json());

    const adAccountId = normalizeAdAccountId(body.adAccountId);
    const dup = await prisma.adConnection.findFirst({ where: { adAccountId } });
    if (dup) throw new ApiError(409, `${adAccountId} is already connected as “${dup.name}”.`);

    // Prove the token can actually read this account before storing anything.
    let currency = "INR";
    try {
      const v = await validateAdAccount(adAccountId, body.accessToken);
      currency = v.currency;
    } catch (e) {
      throw new ApiError(400, `Meta rejected this account/token: ${e instanceof Error ? e.message : "unknown error"}`);
    }

    const created = await prisma.adConnection.create({
      data: { name: body.name, adAccountId, accessToken: body.accessToken, currency },
    });
    return { account: masked(created) };
  });
}
