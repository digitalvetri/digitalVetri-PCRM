import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { listMessages, sendMessage } from "@/lib/chat";

/** GET /api/chat — recent team-chat messages (any signed-in user). */
export async function GET() {
  return withApi(async () => {
    const me = await requireUser();
    const messages = await listMessages();
    return { messages, meId: me.id };
  });
}

const schema = z.object({ body: z.string().min(1).max(2000) });

/** POST /api/chat — send a message to the team channel. */
export async function POST(req: Request) {
  return withApi(async () => {
    const me = await requireUser();
    const { body } = schema.parse(await req.json());
    const message = await sendMessage(me.id, body);
    return { message };
  });
}
