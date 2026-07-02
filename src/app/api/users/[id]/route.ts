import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "SALES", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
});

/** PATCH /api/users/[id] — update role / active state (ADMIN only). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const current = await requireUser("users.manage");
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new ApiError(404, "User not found");

    // Safety: an admin cannot remove their own admin rights or deactivate themselves,
    // which would otherwise lock them out of user management.
    if (current.id === id) {
      if (body.role !== undefined && body.role !== "ADMIN") {
        throw new ApiError(400, "You cannot change your own admin role.");
      }
      if (body.isActive === false) {
        throw new ApiError(400, "You cannot deactivate your own account.");
      }
    }

    const data: { role?: typeof body.role; isActive?: boolean } = {};
    if (body.role !== undefined) data.role = body.role;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const user = await prisma.user.update({
      where: { id },
      data,
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

    return { user };
  });
}
