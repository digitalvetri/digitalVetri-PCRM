import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/rbac";

type Handler<T> = () => Promise<T>;

/**
 * Wrap API route logic with uniform error handling.
 *
 *   export async function GET() {
 *     return withApi(async () => {
 *       const user = await requireUser("companies.view");
 *       return { companies: await prisma.company.findMany() };
 *     });
 *   }
 */
export async function withApi<T>(handler: Handler<T>): Promise<NextResponse> {
  try {
    const data = await handler();
    if (data instanceof NextResponse) return data;
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 }
      );
    }
    // Log the real error server-side, but never leak internal details
    // (Prisma/driver/provider messages) to the client.
    console.error("[api]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
