import { auth, currentUser } from "@clerk/nextjs/server";
import type { Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

export { ApiError };

/**
 * Permission matrix. Keep additive: every permission lists the roles that
 * hold it. ADMIN implicitly holds everything.
 */
const PERMISSIONS = {
  "companies.view": ["ADMIN", "MANAGER", "SALES", "VIEWER"],
  "companies.create": ["ADMIN", "MANAGER", "SALES"],
  "companies.edit": ["ADMIN", "MANAGER", "SALES"],
  "companies.delete": ["ADMIN", "MANAGER"],
  "companies.import": ["ADMIN", "MANAGER", "SALES"],
  "companies.analyze": ["ADMIN", "MANAGER", "SALES"],
  "prospects.view": ["ADMIN", "MANAGER", "SALES", "VIEWER"],
  "prospects.edit": ["ADMIN", "MANAGER", "SALES"],
  "prospects.assign": ["ADMIN", "MANAGER"],
  "prospects.bulkUpdate": ["ADMIN", "MANAGER"],
  "prospects.export": ["ADMIN", "MANAGER", "SALES"],
  "prospects.delete": ["ADMIN", "MANAGER"],
  "prospects.sync": ["ADMIN", "MANAGER"],
  "meetings.view": ["ADMIN", "MANAGER", "SALES", "VIEWER"],
  "meetings.manage": ["ADMIN", "MANAGER", "SALES"],
  "proposals.view": ["ADMIN", "MANAGER", "SALES", "VIEWER"],
  "proposals.manage": ["ADMIN", "MANAGER", "SALES"],
  "content.generate": ["ADMIN", "MANAGER", "SALES"],
  "tasks.view": ["ADMIN", "MANAGER", "SALES", "VIEWER"],
  "tasks.manage": ["ADMIN", "MANAGER", "SALES"],
  "reports.view": ["ADMIN", "MANAGER", "SALES", "VIEWER"],
  "commandCenter.manage": ["ADMIN", "MANAGER", "SALES"],
  "settings.manage": ["ADMIN"],
  "users.manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function roleCan(role: Role, permission: Permission): boolean {
  if (role === "ADMIN") return true;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/**
 * Resolve the current app user from the Clerk session, creating the DB
 * record on first sign-in. The first user ever created becomes ADMIN.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const cu = await currentUser();
  if (!cu) return null;

  const email = cu.emailAddresses[0]?.emailAddress ?? `${clerkId}@unknown.local`;
  const name = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || "User";

  // A user row with this email may already exist (e.g. seeded demo users).
  // Claim it by attaching the real Clerk ID instead of colliding on the
  // unique email constraint.
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { clerkId, name, imageUrl: cu.imageUrl },
    });
  }

  const userCount = await prisma.user.count();
  return prisma.user.create({
    data: {
      clerkId,
      email,
      name,
      imageUrl: cu.imageUrl,
      role: userCount === 0 ? "ADMIN" : "SALES",
    },
  });
}

/** For API routes: returns the user or throws a Response-shaped error. */
export async function requireUser(permission?: Permission): Promise<User> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    throw new ApiError(401, "Not authenticated");
  }
  if (permission && !roleCan(user.role, permission)) {
    throw new ApiError(403, `Missing permission: ${permission}`);
  }
  return user;
}
