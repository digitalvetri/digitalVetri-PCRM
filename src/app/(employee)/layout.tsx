import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getCurrentUser } from "@/lib/rbac";
import { PendingApproval } from "@/components/layout/pending-approval";
import { Logo } from "@/components/shared/logo";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.isActive) return <PendingApproval email={user.email} />;
  // Only employees use this portal; owners/admins go back to the main app.
  if (user.role !== "EMPLOYEE") redirect("/");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo tileSize={30} subtitle="Employee" />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium leading-none">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
