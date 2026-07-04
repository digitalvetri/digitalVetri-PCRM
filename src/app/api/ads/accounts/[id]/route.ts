import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/** DELETE /api/ads/accounts/[id] — disconnect an ad account (ADMIN). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("settings.manage");
    const { id } = await params;
    const existing = await prisma.adConnection.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "Ad account not found");
    await prisma.adConnection.delete({ where: { id } });
    return { ok: true };
  });
}
