import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { AppShell } from "@/components/layout/app-shell";
import { PendingApproval } from "@/components/layout/pending-approval";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.isActive) return <PendingApproval email={user.email} />;

  return <AppShell userRole={user.role}>{children}</AppShell>;
}
