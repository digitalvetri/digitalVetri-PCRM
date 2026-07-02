import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/** GET /api/users — list all users (ADMIN only). */
export async function GET() {
  return withApi(async () => {
    await requireUser("users.manage");
    const users = await prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        imageUrl: true,
        createdAt: true,
      },
    });
    return { users };
  });
}
