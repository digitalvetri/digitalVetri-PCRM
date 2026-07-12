import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { createEmployee } from "@/lib/hr";
import { parseISTDate } from "@/lib/time";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  name: z.string().min(1).max(120),
  employeeCode: z.string().min(1).max(40),
  designation: z.string().max(80).optional(),
  department: z.string().max(80).optional(),
  phone: z.string().max(30).optional(),
  joinDate: z.string().optional(),
  baseSalary: z.coerce.number().min(0).optional(),
});

export const maxDuration = 60;

/** POST /api/team/employees — admin creates an employee login + HR profile. */
export async function POST(req: Request) {
  return withApi(async () => {
    await requireUser("hr.manage");
    const b = schema.parse(await req.json());
    const user = await createEmployee({
      email: b.email,
      password: b.password,
      name: b.name,
      employeeCode: b.employeeCode,
      designation: b.designation,
      department: b.department,
      phone: b.phone,
      joinDate: b.joinDate ? parseISTDate(b.joinDate) ?? undefined : undefined,
      baseSalary: b.baseSalary,
    });
    return { ok: true, id: user.id };
  });
}
