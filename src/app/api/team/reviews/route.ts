import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { createReview } from "@/lib/hr";

const schema = z.object({
  userId: z.string().min(1),
  period: z.string().min(1).max(40),
  rating: z.coerce.number().min(1).max(5),
  strengths: z.string().max(1000).optional().nullable(),
  improvements: z.string().max(1000).optional().nullable(),
  comments: z.string().max(1000).optional().nullable(),
});

/** POST /api/team/reviews — add a performance review for an employee. */
export async function POST(req: Request) {
  return withApi(async () => {
    const user = await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    const review = await createReview({ ...b, reviewerId: user.id });
    return { ok: true, id: review.id };
  });
}
