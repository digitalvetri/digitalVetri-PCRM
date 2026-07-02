import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { getAutomationConfig, setAutomationConfig } from "@/lib/automation";

/** GET — current automation config. */
export async function GET() {
  return withApi(async () => {
    await requireUser("commandCenter.manage");
    return { config: await getAutomationConfig() };
  });
}

const schema = z.object({
  enabled: z.boolean(),
  watchlists: z
    .array(z.object({ industry: z.string().trim().min(1), city: z.string().trim().min(1) }))
    .max(20),
  digestChannel: z.enum(["none", "whatsapp", "email"]),
  digestTo: z.string().trim().max(200),
  batchSize: z.coerce.number().min(1).max(12),
  autoDraft: z.boolean(),
});

/** POST — save automation config. */
export async function POST(req: Request) {
  return withApi(async () => {
    await requireUser("commandCenter.manage");
    const cfg = schema.parse(await req.json());
    await setAutomationConfig(cfg);
    return { ok: true, config: cfg };
  });
}
