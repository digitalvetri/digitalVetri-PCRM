import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/rbac";
import { PendingApproval } from "@/components/layout/pending-approval";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.isActive) return <PendingApproval email={user.email} />;
  // Only employees use this portal; owners/admins go back to the main app.
  if (user.role !== "EMPLOYEE") redirect("/");

  // Full-bleed — the portal renders its own full-screen sidebar + header shell.
  return <div className="min-h-screen bg-muted/30">{children}</div>;
}
