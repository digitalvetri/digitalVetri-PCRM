import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { addSubtask } from "@/lib/hr";

const schema = z.object({ title: z.string().min(1).max(200) });

/** POST /api/me/tasks/[id]/subtasks — add a checklist item to your task. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const me = await requireUser();
    const { id } = await params;
    const b = schema.parse(await req.json());
    const subtask = await addSubtask(me.id, id, b.title);
    return { subtask };
  });
}
