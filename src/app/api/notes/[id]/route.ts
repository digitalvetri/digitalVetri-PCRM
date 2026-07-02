import { withApi } from "@/lib/api";
import { requireUser, roleCan, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/** DELETE /api/notes/[id] — remove a note (author, or a manager/admin). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("companies.view");
    const { id } = await params;

    const note = await prisma.note.findUnique({ where: { id } });
    if (!note) throw new ApiError(404, "Note not found");

    if (note.authorId !== user.id && !roleCan(user.role, "companies.delete")) {
      throw new ApiError(403, "You can only delete your own notes.");
    }

    await prisma.note.delete({ where: { id } });
    return { ok: true };
  });
}
