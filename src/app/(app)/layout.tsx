import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return <AppShell userRole={user.role}>{children}</AppShell>;
}
