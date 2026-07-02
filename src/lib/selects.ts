import { Prisma } from "@prisma/client";

/**
 * The user fields safe to embed in API responses (assignee, note author,
 * follow-up owner, …). Deliberately omits `clerkId` — an auth-provider
 * identifier that should never leave the server — and internal timestamps.
 */
export const userCardSelect = {
  id: true,
  name: true,
  email: true,
  imageUrl: true,
  role: true,
  isActive: true,
} satisfies Prisma.UserSelect;
